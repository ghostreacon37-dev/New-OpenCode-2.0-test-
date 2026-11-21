// flows.js — Custom redirect method step orchestration (exact 5 steps)
//
// Step 1: Go to website, wait 5-15s, click Open (scan whole page)
// Step 2: Wait 10-20s, click Next, optional Scroll Down, wait 5-10s
// Step 3: Click Open, reload site, 67/100 probability scroll, wait 3-13s
// Step 4: Click Continue, wait 3-7s
// Step 5: Click Go to Link, wait 2-12s

const {
  humanClick, humanScroll, humanMicroActions, humanHover,
  humanTextSelection, humanPause, humanReadPage, humanTabSwitch,
  humanBlurWindow, humanMisclick, humanBackNavigate,
} = require('./humanActions');

const config = require('./config');
const { rand, randFloat, chance, sleep } = require('./utils');

/**
 * Main tab flow — follows the 5-step redirect method exactly.
 * If Step 1 fails, the bot STOPS immediately.
 *
 * @param {Object} opts
 * @param {Object} opts.puppeteer - puppeteer-extra instance
 * @param {Object} opts.page - Puppeteer page
 * @param {Object} opts.cfg - parsed config
 * @param {Object} opts.browser - browser instance (for tab switching)
 * @param {number} opts.run - current run number
 * @param {number} opts.tabIndex - tab index
 */
async function runTabFlow({ puppeteer, page, cfg, run, browser, tabIndex }) {
  const meta = { tab: tabIndex, run, clicked: 0, postOpened: false, finalUrl: '', success: false, step: 0, error: null };

  const preset = config.SPEED_PRESETS[cfg.speed || 'normal'] || config.SPEED_PRESETS.normal;
  const mult = preset.multiplier;
  const readMult = preset.readMultiplier;

  const skew = (min, max) => Math.max(config.randSkewed(min, max, 0.5) * mult, 600);

  try {
    // ==================================================================
    // STEP 1: Go to website and wait 5-15sec, click Open button
    // If this step fails, the bot STOPS immediately.
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    const loaded = await stepNavigateToTarget(page, cfg, tabIndex);
    if (!loaded) {
      meta.error = 'page_load_failed';
      meta.step = 0;
      console.log(`  tab[${tabIndex}] STEP-1: Page failed to load, stopping.`);
      return meta;
    }

    const wait1 = skew(config.step1WaitBeforeOpen.min, config.step1WaitBeforeOpen.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: waiting ~${Math.round(wait1 / 1000)}s before Open`);
    await humanReadPage(page, { debug: cfg.debug, maxMs: 8000 * readMult });
    await humanMicroActions(page, wait1, { debug: cfg.debug });

    const openButton = await findOpenButton(page, cfg.debug);
    if (!openButton) {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: Open button not found — STOPPING BOT`);
      meta.step = 1;
      meta.error = 'open_button_not_found';
      return meta;
    }
    await maybeMisclickEl(page, openButton, cfg.debug);
    await hoverAndHesitateEl(page, openButton, cfg.debug);
    const clicked = await humanClick(page, openButton, { debug: cfg.debug });
    if (!clicked) { meta.step = 1; meta.error = 'open_click_failed'; return meta; }
    meta.clicked++; meta.step = 1;
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: Open button clicked`);

    await maybeTabSwitch(page, browser, cfg, tabIndex);
    await maybeBlurWindow(page, cfg, tabIndex);

    // ==================================================================
    // STEP 2: Wait 10-20sec, click Next, handle Scroll Down, wait 5-10sec
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    const wait2 = skew(config.step2WaitAfterOpen.min, config.step2WaitAfterOpen.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: waiting ~${Math.round(wait2 / 1000)}s after Open`);
    await humanPause(page, wait2, { debug: cfg.debug });

    await sleep(clampedRand(100, 300, 0.5));
    const nextButton = await findNextButton(page, cfg.debug);
    if (nextButton) {
      await hoverAndHesitateEl(page, nextButton, cfg.debug);
      await humanClick(page, nextButton, { debug: cfg.debug });
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: Next button clicked`);
    } else if (cfg.debug) {
      console.log(`  tab[${tabIndex}] STEP-2: Next button not found`);
    }

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
    // STEP 3: Click Open again, reload site, 67/100 probability, wait 3-13sec
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    const openButton2 = await findOpenButton(page, cfg.debug);
    if (openButton2) {
      await hoverAndHesitateEl(page, openButton2, cfg.debug);
      await humanClick(page, openButton2, { debug: cfg.debug });
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
    // STEP 4: Click Continue button, wait 3-7sec
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    const continueButton = await findContinueButton(page, cfg.debug);
    if (continueButton) {
      await hoverAndHesitateEl(page, continueButton, cfg.debug);
      await humanClick(page, continueButton, { debug: cfg.debug });
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-4: Continue button clicked`);
    }

    const wait5 = skew(config.step4WaitAfterContinue.min, config.step4WaitAfterContinue.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-4: waiting ~${Math.round(wait5 / 1000)}s`);
    await humanPause(page, wait5, { debug: cfg.debug });
    meta.step = 4;

    // ==================================================================
    // STEP 5: Click Go to Link button, wait 2-12sec
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    const goToLinkButton = await findGoToLinkButton(page, cfg.debug);
    if (goToLinkButton) {
      await hoverAndHesitateEl(page, goToLinkButton, cfg.debug);
      await humanClick(page, goToLinkButton, { debug: cfg.debug });
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
    return meta;
  }
}

/* ========================================================================= */
/*  Step helpers                                                             */
/* ========================================================================= */

async function stepNavigateToTarget(page, cfg, tabIndex) {
  const loadTimeout = cfg.pageLoadTimeout || 73000;
  let loaded = false;

  console.log(`  tab[${tabIndex}] Loading page: ${cfg.target}`);

  // Try domcontentloaded first (fires when HTML is parsed, more reliable)
  try {
    await page.goto(cfg.target, { waitUntil: 'domcontentloaded', timeout: loadTimeout });
    loaded = true;
    console.log(`  tab[${tabIndex}] domcontentloaded fired`);
  } catch (err) {
    console.log(`  tab[${tabIndex}] domcontentloaded failed: ${err && err.message}`);
  }

  // Wait up to 73 seconds for the page to fully render
  // Check document.readyState every 500ms
  if (loaded) {
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
      console.log(`  tab[${tabIndex}] page did not fully load in ${loadTimeout / 1000}s — pausing this tab`);
      return false;
    }
  } else {
    console.log(`  tab[${tabIndex}] page failed to load — pausing this tab`);
    return false;
  }

  // Also try to wait for body to have content (buttons, text, etc.)
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

async function hoverAndHesitateEl(page, el, debug) {
  try {
    const box = await el.boundingBox().catch(() => null);
    if (box) {
      const x = clamp(rand(box.x + 4, box.x + box.width - 4), box.x, box.x + box.width);
      const y = clamp(rand(box.y + 4, box.y + box.height - 4), box.y, box.y + box.height);
      await humanMove(page, x, y, { steps: rand(6, 14), speed: randFloat(0.7, 1.2) });
    }
    await sleep(rand(60, 200));
  } catch (_) {}
}

function shouldBail(abandonment) {
  return chance(abandonment.perStepBailChance);
}

function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }
function clampedRand(min, max, bias = 0.5) {
  const u = Math.pow(Math.random(), 1 / (bias * 2 + 0.1));
  return Math.floor(min + u * (max - min + 1));
}

/* ========================================================================= */
/*  Button finders — YOUR EXACT PATTERN for every button                     */
/* ========================================================================= */

/**
 * Find Open button — YOUR EXACT PATTERN:
 * const allButtons = document.querySelectorAll('button');
 * const openButtons = [...allButtons].filter(button =>
 *     button.textContent.trim().toLowerCase() === 'open'
 * );
 */
async function findOpenButton(page, debug) {
  await sleep(500);
  const result = await page.evaluate(() => {
    const allButtons = document.querySelectorAll('button');
    const openButtons = [...allButtons].filter(button =>
      button.textContent.trim().toLowerCase() === 'open'
    );
    console.log(`Found ${openButtons.length} Open button(s)`);
    if (openButtons.length > 0) {
      const btn = openButtons[0];
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
      }
    }
    // Fallback: try a, span, div with role="button"
    const allElements = document.querySelectorAll('a, span, div, [role="button"]');
    const openElements = [...allElements].filter(el =>
      el.textContent.trim().toLowerCase() === 'open'
    );
    if (openElements.length > 0) {
      const el = openElements[0];
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
      }
    }
    return { found: false };
  });
  if (result && result.found) {
    if (debug) console.log(`  findOpenButton: found at x=${result.x}, y=${result.y}`);
    return { x: result.x, y: result.y };
  }
  if (debug) console.log('  findOpenButton: no Open button found');
  return null;
}

/**
 * Find Next button — YOUR EXACT PATTERN with 'next'
 */
async function findNextButton(page, debug) {
  await sleep(500);
  const result = await page.evaluate(() => {
    const allButtons = document.querySelectorAll('button');
    const nextButtons = [...allButtons].filter(button =>
      button.textContent.trim().toLowerCase() === 'next'
    );
    console.log(`Found ${nextButtons.length} Next button(s)`);
    if (nextButtons.length > 0) {
      const btn = nextButtons[0];
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
      }
    }
    // Fallback: try a, span, div
    const allElements = document.querySelectorAll('a, span, div, [role="button"]');
    const nextElements = [...allElements].filter(el =>
      el.textContent.trim().toLowerCase() === 'next'
    );
    if (nextElements.length > 0) {
      const el = nextElements[0];
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
      }
    }
    return { found: false };
  });
  if (result && result.found) {
    if (debug) console.log(`  findNextButton: found at x=${result.x}, y=${result.y}`);
    return { x: result.x, y: result.y };
  }
  if (debug) console.log('  findNextButton: no Next button found');
  return null;
}

/**
 * Check if "Scroll Down" appears — YOUR EXACT PATTERN with scroll text
 */
async function checkScrollDown(page, debug) {
  const result = await page.evaluate(() => {
    const allButtons = document.querySelectorAll('button');
    const scrollButtons = [...allButtons].filter(button => {
      const t = button.textContent.trim().toLowerCase();
      return t === 'scroll down' || t.includes('scroll down');
    });
    console.log(`Found ${scrollButtons.length} Scroll Down button(s)`);
    if (scrollButtons.length > 0) {
      const btn = scrollButtons[0];
      const rect = btn.getBoundingClientRect();
      return { found: rect.width > 0 && rect.height > 0 };
    }
    // Fallback: try a, span, div
    const allElements = document.querySelectorAll('a, span, div, [role="button"]');
    const scrollElements = [...allElements].filter(el => {
      const t = el.textContent.trim().toLowerCase();
      return t === 'scroll down' || t.includes('scroll down');
    });
    if (scrollElements.length > 0) {
      const el = scrollElements[0];
      const rect = el.getBoundingClientRect();
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
}

/**
 * Find Continue button — YOUR EXACT PATTERN with 'continue'
 */
async function findContinueButton(page, debug) {
  await sleep(500);
  const result = await page.evaluate(() => {
    const allButtons = document.querySelectorAll('button');
    const continueButtons = [...allButtons].filter(button =>
      button.textContent.trim().toLowerCase() === 'continue'
    );
    console.log(`Found ${continueButtons.length} Continue button(s)`);
    if (continueButtons.length > 0) {
      const btn = continueButtons[0];
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
      }
    }
    // Fallback: try a, span, div
    const allElements = document.querySelectorAll('a, span, div, [role="button"]');
    const continueElements = [...allElements].filter(el =>
      el.textContent.trim().toLowerCase() === 'continue'
    );
    if (continueElements.length > 0) {
      const el = continueElements[0];
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
      }
    }
    return { found: false };
  });
  if (result && result.found) {
    if (debug) console.log(`  findContinueButton: found at x=${result.x}, y=${result.y}`);
    return { x: result.x, y: result.y };
  }
  if (debug) console.log('  findContinueButton: no Continue button found');
  return null;
}

/**
 * Find Go to Link button — YOUR EXACT PATTERN with 'go to link'
 */
async function findGoToLinkButton(page, debug) {
  await sleep(500);
  const result = await page.evaluate(() => {
    const allButtons = document.querySelectorAll('button');
    const goToLinkButtons = [...allButtons].filter(button =>
      button.textContent.trim().toLowerCase() === 'go to link'
    );
    console.log(`Found ${goToLinkButtons.length} Go to Link button(s)`);
    if (goToLinkButtons.length > 0) {
      const btn = goToLinkButtons[0];
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
      }
    }
    // Fallback: try a, span, div
    const allElements = document.querySelectorAll('a, span, div, [role="button"]');
    const goToLinkElements = [...allElements].filter(el =>
      el.textContent.trim().toLowerCase() === 'go to link'
    );
    if (goToLinkElements.length > 0) {
      const el = goToLinkElements[0];
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, found: true };
      }
    }
    return { found: false };
  });
  if (result && result.found) {
    if (debug) console.log(`  findGoToLinkButton: found at x=${result.x}, y=${result.y}`);
    return { x: result.x, y: result.y };
  }
  if (debug) console.log('  findGoToLinkButton: no Go to Link button found');
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Human "error" wrappers                                                    */
/* -------------------------------------------------------------------------- */

async function maybeMisclick(page, el, debug) {
  if (!chance(0.06)) return false;
  try {
    const mx = el.x + rand(-15, 15);
    const my = el.y + rand(-15, 15);
    await humanMove(page, mx, my, { steps: rand(6, 13), speed: randFloat(0.7, 1.2) });
    await sleep(rand(70, 200));
    await page.mouse.down().catch(() => {});
    await sleep(rand(25, 90));
    await page.mouse.up().catch(() => {});
    await sleep(rand(180, 450));
    if (debug) console.log('  human misclick (off-target), correcting');
    return true;
  } catch (_) { return false; }
}

async function maybeTabSwitch(page, browser, cfg, tabIndex) {
  if (!chance(config.reading.tabSwitchChance)) return;
  try {
    const pages = await browser.pages();
    const others = pages.filter(p => p !== page);
    if (others.length === 0) return;
    const target = others[rand(0, others.length - 1)];
    await target.bringToFront().catch(() => {});
    if (cfg.debug) console.log(`  tab[${tabIndex}] switched away briefly`);
    await sleep(rand(1200, 3200));
    await page.bringToFront().catch(() => {});
  } catch (_) {}
}

async function maybeBlurWindow(page, cfg, tabIndex) {
  if (!chance(config.reading.windowBlurChance)) return;
  try {
    await page.evaluate(() => { window.dispatchEvent(new FocusEvent('blur')); }).catch(() => {});
    await sleep(rand(600, 1700));
    await page.evaluate(() => { window.dispatchEvent(new FocusEvent('focus')); }).catch(() => {});
    if (cfg.debug) console.log(`  tab[${tabIndex}] window blurred & refocused`);
  } catch (_) {}
}

module.exports = { runTabFlow };
