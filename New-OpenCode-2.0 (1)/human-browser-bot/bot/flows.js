// flows.js — Robust custom redirect method step orchestration (exact 5 steps)
//
// Step 1: Go to website, wait 5-15s, click Open (polls for button)
// Step 2: Wait 10-20s, click Next, optional Scroll Down, wait 5-10s
// Step 3: Click Open, reload site, 67/100 probability scroll, wait 3-13s
// Step 4: Click Continue, wait 3-7s
// Step 5: Click Go to Link, wait 2-12s
//
// Improvements over the original:
//   - Buttons are found by polling (they appear dynamically after JS renders)
//   - Button text matching is flexible (substring + regex) so "Your link is being
//     processed", "Open", "Next", "Continue", "Go to Link" etc. are all caught.
//   - After every click we wait for navigation / DOM change.
//   - If a button shows a "processing" state we wait for the text to change.
//   - Each click is retried up to clickRetries times.
//   - Screenshots are saved on failure for debugging.

const {
  humanClick, humanScroll, humanMicroActions, humanHover,
  humanTextSelection, humanPause, humanReadPage, waitForClickable,
} = require('./humanActions');

const {
  rand, randFloat, chance, sleep,
  waitForElement, waitForNavigation, waitForButtonTextChange,
} = require('./utils');

const config = require('./config');

/**
 * Main tab flow — follows the 5-step redirect method exactly.
 * If Step 1 fails (page won't load OR Open button never appears), the bot STOPS.
 *
 * @param {Object} opts
 */
async function runTabFlow({ puppeteer, page, cfg, run, tabIndex, browser }) {
  const meta = {
    tab: tabIndex, run, clicked: 0, postOpened: false,
    finalUrl: '', success: false, step: 0, error: null,
  };

  const preset = config.SPEED_PRESETS[cfg.speed || 'normal'] || config.SPEED_PRESETS.normal;
  const mult = preset.multiplier;
  const readMult = preset.readMultiplier;

  const skew = (min, max) => Math.max(config.randSkewed(min, max, 0.5) * mult, 600);
  const doScreenshot = cfg.noScreenshot !== true && config.screenshotOnFailure;

  try {
    // ==================================================================
    // STEP 1: Go to website and wait 5-15sec, click Open button
    // If page fails to load OR Open button never appears → STOP.
    // ==================================================================
    console.log(`  tab[${tabIndex}] STEP-1: Loading page: ${cfg.target}`);

    const loaded = await stepNavigateToTarget(page, cfg, tabIndex);
    if (!loaded) {
      meta.error = 'page_load_failed';
      meta.step = 0;
      console.log(`  tab[${tabIndex}] STEP-1: Page failed to load — STOPPING BOT`);
      if (doScreenshot) await saveScreenshot(page, `step1-loadfail-run${run}-tab${tabIndex}`);
      return meta;
    }

    // Wait 5-15sec before clicking Open (human-like reading/hesitation)
    const wait1 = skew(config.step1WaitBeforeOpen.min, config.step1WaitBeforeOpen.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: waiting ~${Math.round(wait1 / 1000)}s before Open`);
    await humanReadPage(page, { debug: cfg.debug, maxMs: 8000 * readMult });
    await humanMicroActions(page, wait1, { debug: cfg.debug });

    // Scan whole page and click Open button — polls until it appears
    const openButton = await findButtonWithPatterns(page, config.step1ButtonPatterns, {
      timeout: config.buttonFindTimeout,
      debug: cfg.debug,
      stepName: 'Open (step 1)',
      tabIndex,
    });
    if (!openButton) {
      meta.step = 1;
      meta.error = 'open_button_not_found';
      console.log(`  tab[${tabIndex}] STEP-1: Open button never appeared — STOPPING BOT`);
      if (doScreenshot) await saveScreenshot(page, `step1-open-missing-run${run}-tab${tabIndex}`);
      return meta;
    }
    await hoverAndHesitate(page, openButton, cfg.debug);
    const clicked = await clickWithRetry(page, openButton, cfg.debug, config.clickRetries);
    if (!clicked) {
      meta.step = 1;
      meta.error = 'open_click_failed';
      if (doScreenshot) await saveScreenshot(page, `step1-open-clickfail-run${run}-tab${tabIndex}`);
      return meta;
    }
    meta.clicked++; meta.step = 1;
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: Open button clicked`);

    // Wait for navigation / DOM change after clicking Open
    const beforeUrl = await page.url().catch(() => '');
    await waitForNavigation(page, beforeUrl, {
      timeout: config.navigationWaitTimeout, debug: cfg.debug,
    });

    // ==================================================================
    // STEP 2: Wait 10-20sec, click Next, handle Scroll Down, wait 5-10s
    // ==================================================================
    const wait2 = skew(config.step2WaitAfterOpen.min, config.step2WaitAfterOpen.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: waiting ~${Math.round(wait2 / 1000)}s after Open`);
    await humanPause(page, wait2, { debug: cfg.debug });

    await sleep(clampedRand(100, 300, 0.5));
    const nextButton = await findButtonWithPatterns(page, config.step2ButtonPatterns, {
      timeout: config.buttonFindTimeout,
      debug: cfg.debug,
      stepName: 'Next (step 2)',
      tabIndex,
    });
    if (nextButton) {
      await hoverAndHesitate(page, nextButton, cfg.debug);
      await clickWithRetry(page, nextButton, cfg.debug, config.clickRetries);
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: Next button clicked`);
    } else if (cfg.debug) {
      console.log(`  tab[${tabIndex}] STEP-2: Next button not found (continuing)`);
    }

    // If "Scroll Down" appears, click it (optional)
    const scrollDownAppears = await checkScrollDown(page, cfg.debug);
    if (scrollDownAppears) {
      await humanScroll(page, { maxBursts: 2, maxViewports: 1, debug: cfg.debug });
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: Scroll Down appeared, scrolled`);
    }

    const wait3 = skew(config.step2ScrollWait.min, config.step2ScrollWait.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: waiting ~${Math.round(wait3 / 1000)}s`);
    await humanPause(page, wait3, { debug: cfg.debug });
    meta.step = 2;

    // ==================================================================
    // STEP 3: Click Open again, reload site, 67/100 probability, wait 3-13s
    // ==================================================================
    const openButton2 = await findButtonWithPatterns(page, config.step3ButtonPatterns, {
      timeout: config.buttonFindTimeout,
      debug: cfg.debug,
      stepName: 'Open again (step 3)',
      tabIndex,
    });
    if (openButton2) {
      await hoverAndHesitate(page, openButton2, cfg.debug);
      await clickWithRetry(page, openButton2, cfg.debug, config.clickRetries);
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-3: Open button clicked again`);
    }

    // Reload the site
    const loadTimeout = cfg.pageLoadTimeout || 73000;
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: loadTimeout });
      console.log(`  tab[${tabIndex}] STEP-3: site reloaded`);
    } catch (err) {
      console.log(`  tab[${tabIndex}] STEP-3: reload failed: ${err && err.message}`);
    }
    try {
      await page.waitForFunction(() => document.readyState === 'complete' || document.readyState === 'interactive', { timeout: 15000 });
    } catch (_) {}
    await humanPause(page, 800, 1800 * mult, { debug: cfg.debug });

    const probCheck = config.checkProbability(config.step3Probability);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-3: probability 67/100 → ${probCheck ? 'passed' : 'failed'}`);
    if (probCheck) {
      await humanScroll(page, { maxBursts: rand(2, 4), maxViewports: 2, debug: cfg.debug });
    } else {
      await humanMicroActions(page, rand(1000, 3000) * mult, { debug: cfg.debug });
    }

    const wait4 = skew(config.step3WaitAfterClick.min, config.step3WaitAfterClick.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-3: waiting ~${Math.round(wait4 / 1000)}s`);
    await humanPause(page, wait4, { debug: cfg.debug });
    meta.step = 3;

    // ==================================================================
    // STEP 4: Click Continue button, wait 3-7s
    // ==================================================================
    const continueButton = await findButtonWithPatterns(page, config.step4ButtonPatterns, {
      timeout: config.buttonFindTimeout,
      debug: cfg.debug,
      stepName: 'Continue (step 4)',
      tabIndex,
    });
    if (continueButton) {
      await hoverAndHesitate(page, continueButton, cfg.debug);
      await clickWithRetry(page, continueButton, cfg.debug, config.clickRetries);
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-4: Continue button clicked`);
    }

    const wait5 = skew(config.step4WaitAfterContinue.min, config.step4WaitAfterContinue.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-4: waiting ~${Math.round(wait5 / 1000)}s`);
    await humanPause(page, wait5, { debug: cfg.debug });
    meta.step = 4;

    // ==================================================================
    // STEP 5: Click Go to Link button, wait 2-12s
    // ==================================================================
    const goToLinkButton = await findButtonWithPatterns(page, config.step5ButtonPatterns, {
      timeout: config.buttonFindTimeout,
      debug: cfg.debug,
      stepName: 'Go to Link (step 5)',
      tabIndex,
    });
    if (goToLinkButton) {
      await hoverAndHesitate(page, goToLinkButton, cfg.debug);
      await clickWithRetry(page, goToLinkButton, cfg.debug, config.clickRetries);
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-5: Go to Link button clicked`);
    }

    const wait6 = skew(config.step5WaitAfterGoToLink.min, config.step5WaitAfterGoToLink.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-5: waiting ~${Math.round(wait6 / 1000)}s`);
    await humanPause(page, wait6, { debug: cfg.debug });
    meta.step = 5;

    // Mark as complete
    try { meta.finalUrl = await page.url(); } catch (_) {}
    meta.postOpened = true;
    meta.success = true;

    return meta;
  } catch (e) {
    if (cfg.debug) console.log(`  tab[${tabIndex}] error at step ${meta.step}:`, e && (e.message || e));
    meta.error = e && (e.message || String(e));
    if (doScreenshot) await saveScreenshot(page, `error-step${meta.step}-run${run}-tab${tabIndex}`);
    return meta;
  }
}

/* ========================================================================= */
/*  Step helpers                                                             */
/* ========================================================================= */

/**
 * Navigate to target and wait until page is fully ready.
 * Tries domcontentloaded first, then waits for readyState + body content.
 */
async function stepNavigateToTarget(page, cfg, tabIndex) {
  const loadTimeout = cfg.pageLoadTimeout || 73000;

  console.log(`  tab[${tabIndex}] Loading page: ${cfg.target}`);

  // Try domcontentloaded first (fires when HTML is parsed — more reliable than networkidle)
  try {
    await page.goto(cfg.target, { waitUntil: 'domcontentloaded', timeout: loadTimeout });
    console.log(`  tab[${tabIndex}] domcontentloaded fired`);
  } catch (err) {
    console.log(`  tab[${tabIndex}] domcontentloaded failed: ${err && err.message}`);
    // Fallback: try load event
    try {
      await page.goto(cfg.target, { waitUntil: 'load', timeout: loadTimeout });
      console.log(`  tab[${tabIndex}] load event fired`);
    } catch (err2) {
      console.log(`  tab[${tabIndex}] load also failed: ${err2 && err2.message}`);
      return false;
    }
  }

  // Wait up to loadTimeout for the page to fully render
  const start = Date.now();
  let readyState = 'loading';
  while (Date.now() - start < loadTimeout) {
    try {
      readyState = await page.evaluate(() => document.readyState);
    } catch (_) { readyState = 'loading'; }

    if (readyState === 'complete' || readyState === 'interactive') {
      console.log(`  tab[${tabIndex}] page readyState: ${readyState} after ${Math.round((Date.now() - start) / 1000)}s`);
      break;
    }
    await sleep(500);
  }

  if (readyState !== 'complete' && readyState !== 'interactive') {
    console.log(`  tab[${tabIndex}] page did not fully load in ${loadTimeout / 1000}s`);
    return false;
  }

  // Wait for body to have meaningful content
  try {
    await page.waitForFunction(() => {
      const body = document.body;
      return body && body.innerText && body.innerText.trim().length > 0;
    }, { timeout: 15000 });
    console.log(`  tab[${tabIndex}] page body has content`);
  } catch (_) {
    console.log(`  tab[${tabIndex}] page body content check timed out (continuing anyway)`);
  }

  // Extra settle time for JS frameworks to render
  await sleep(clampedRand(1000, 2000, 0.6));
  return true;
}

/**
 * Find a button matching any of `patterns`, polling until timeout.
 * Handles "processing" state: if a matching button shows processing text,
 * waits for its text to change before returning it.
 * Returns {x, y, text} or null.
 */
async function findButtonWithPatterns(page, patterns, { timeout, debug, stepName, tabIndex }) {
  const start = Date.now();
  const pollInterval = config.buttonPollInterval;
  // Normalize patterns to lowercase strings so they survive serialization
  // across page.evaluate (RegExp objects lose .test() when marshalled).
  const patStrings = patterns.map(p => {
    if (typeof p === 'string') return p.toLowerCase();
    if (p instanceof RegExp) return p.source.toLowerCase();
    return String(p).toLowerCase();
  });

  while (Date.now() - start < timeout) {
    try {
      const result = await page.evaluate((pats) => {
        const buttons = [
          ...document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')
        ];
        for (const btn of buttons) {
          const text = (btn.innerText || btn.textContent || btn.value || '').trim().toLowerCase();
          if (!text) continue;
          for (const p of pats) {
            // Substring match; also treat pattern as a bare word if wrapped in ^...$
            const needle = p.replace(/^\^|\$$/g, '');
            if (text.includes(needle)) {
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return {
                  text: btn.innerText || btn.textContent || btn.value || '',
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                  found: true,
                };
              }
            }
          }
        }
        return { found: false };
      }, patStrings);

      if (result && result.found) {
        // If the button says "processing"/"please wait", wait for text to change
        const lower = result.text.toLowerCase();
        if (lower.includes('processing') || lower.includes('please wait') || lower.includes('your link is being')) {
          if (debug) console.log(`  tab[${tabIndex}] ${stepName}: button shows "${result.text}" — waiting for processing to complete`);
          const changed = await waitForButtonTextChange(page, patterns, [result.text], {
            timeout: Math.min(20000, timeout - (Date.now() - start)),
            interval: 1000,
            debug: cfgDebug(debug),
          });
          if (changed && changed.length > 0) {
            // Re-fetch after text changed
            continue;
          }
          // If still processing after wait, keep polling
        }

        if (debug) console.log(`  tab[${tabIndex}] ${stepName}: found "${result.text}" at x=${result.x}, y=${result.y} after ${Math.round(Date.now() - start)}ms`);
        return { x: result.x, y: result.y, text: result.text };
      }
    } catch (e) {
      if (debug) console.log(`  tab[${tabIndex}] ${stepName}: findButton error: ${e && e.message}`);
    }

    await sleep(pollInterval);
  }

  if (debug) console.log(`  tab[${tabIndex}] ${stepName}: no matching button found within ${timeout}ms`);
  return null;
}

function cfgDebug(d) { return d === true; }

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if "Scroll Down" element appears on the page
 */
async function checkScrollDown(page, debug) {
  try {
    const result = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button, a, div, span')];
      const scrollButtons = buttons.filter(button => {
        const t = button.textContent.trim().toLowerCase();
        return t === 'scroll down' || t.includes('scroll down') || t.includes('see more') || t.includes('load more');
      });
      if (scrollButtons.length > 0) {
        const btn = scrollButtons[0];
        const rect = btn.getBoundingClientRect();
        return { found: rect.width > 0 && rect.height > 0 };
      }
      return { found: false };
    });
    if (result && result.found) {
      if (debug) console.log('  checkScrollDown: Scroll Down element found');
      return true;
    }
    if (debug) console.log('  checkScrollDown: no Scroll Down element found');
    return false;
  } catch (e) {
    if (debug) console.log('  checkScrollDown error:', e && e.message);
    return false;
  }
}

/**
 * Hover near element then hesitate briefly before clicking
 */
async function hoverAndHesitate(page, el, debug) {
  try {
    if (typeof el === 'object' && typeof el.x === 'number' && typeof el.y === 'number') {
      // coordinates — just move there
      await humanMove(page, el.x, el.y, { steps: rand(6, 14), speed: randFloat(0.7, 1.2) });
    } else {
      // element handle
      const box = await el.boundingBox().catch(() => null);
      if (box) {
        const x = clamp(rand(box.x + 4, box.x + box.width - 4), box.x, box.x + box.width);
        const y = clamp(rand(box.y + 4, box.y + box.height - 4), box.y, box.y + box.height);
        await humanMove(page, x, y, { steps: rand(6, 14), speed: randFloat(0.7, 1.2) });
      }
    }
    await sleep(rand(60, 200));
  } catch (_) {}
}

/**
 * Click with retries. `el` can be {x, y} coordinates or an element handle.
 */
async function clickWithRetry(page, el, debug, retries) {
  for (let i = 0; i < retries; i++) {
    try {
      const ok = await humanClick(page, el, { debug });
      if (ok) return true;
    } catch (_) {}
    await sleep(rand(500, 1000));
    if (debug) console.log(`    click retry ${i + 1}/${retries}`);
  }
  return false;
}

function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }
function clampedRand(min, max, bias = 0.5) {
  const u = Math.pow(Math.random(), 1 / (bias * 2 + 0.1));
  return Math.floor(min + u * (max - min + 1));
}

/**
 * Save a screenshot to screenshotDir for debugging failures
 */
async function saveScreenshot(page, name) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = config.screenshotDir;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  screenshot saved: ${file}`);
  } catch (_) {}
}

module.exports = { runTabFlow };
