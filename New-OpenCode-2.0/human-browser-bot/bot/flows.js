// flows.js — Custom redirect method step orchestration (exact 5 steps)
//
// Step 1: Go to website, wait for full load (max 63s), wait 5-15s, click Open
// Step 2: Wait 10-20s, click Next, optional Scroll Down, wait 5-10s
// Step 3: Click Open, wait 3-13s, 67/100 probability scroll
// Step 4: Click Continue, wait 3-7s
// Step 5: Click Go to Link, wait 2-12s
//
// STRICT STEP GATING: Each step MUST complete before the next step starts.
// If any step fails, flow stops immediately — no skipping.

const {
  humanClick, humanScroll, humanMicroActions, humanHover,
  humanTextSelection, humanPause, humanReadPage, humanTabSwitch,
  humanBlurWindow, humanMisclick, humanBackNavigate,
} = require('./humanActions');

const config = require('./config');
const { rand, randFloat, chance, sleep } = require('./utils');

/**
 * Wait for the page to fully load, with a maximum timeout of 63 seconds.
 * Polls document.readyState until 'complete' or maxMs is reached.
 * If the site loads before 63 seconds, proceeds immediately.
 * Does NOT block page loading — only polls after navigation.
 *
 * @param {Object} page - Puppeteer page
 * @param {number} maxMs - Maximum wait time in ms (default 63000 = 63s)
 * @param {boolean} debug - Debug logging
 * @returns {Object} { loaded: boolean, waitedMs: number }
 */
async function waitForFullPageLoad(page, maxMs = 63000, debug = false) {
  const start = Date.now();
  const pollInterval = 500;

  if (debug) console.log(`  waiting for full page load (max ${Math.round(maxMs / 1000)}s)...`);

  while (Date.now() - start < maxMs) {
    try {
      const readyState = await page.evaluate(() => document.readyState).catch(() => 'loading');
      if (readyState === 'complete') {
        const waited = Date.now() - start;
        if (debug) console.log(`  page fully loaded after ${Math.round(waited / 1000)}s`);
        return { loaded: true, waitedMs: waited };
      }
    } catch (_) {}
    await sleep(pollInterval);
  }

  const waited = Date.now() - start;
  if (debug) console.log(`  page load timeout reached after ${Math.round(waited / 1000)}s — proceeding anyway`);
  return { loaded: false, waitedMs: waited };
}

/**
 * Main tab flow — follows the 5-step redirect method exactly.
 * Waits for full page load (max 63s) before starting steps.
 * If site loads before 63s, proceeds immediately.
 * STRICT: Each step MUST complete before the next step starts.
 * If any step fails, flow stops immediately — no skipping.
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
    // STEP 1: Go to website, wait for full load (max 63s), wait 5-15s, click Open
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    // Navigate to target — domcontentloaded fires early, doesn't block page loading
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: navigating to ${cfg.target}`);
    await page.goto(cfg.target, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((err) => {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: goto failed: ${err && err.message}`);
    });

    // Wait for full page load (max 63s) — proceeds immediately if loaded before 63s
    await waitForFullPageLoad(page, 63000, cfg.debug);
    await sleep(rand(1000, 2000)); // extra settle time after load

    // Wait 5-15sec before clicking Open (human-like reading/hesitation)
    const wait1 = skew(config.step1WaitBeforeOpen.min, config.step1WaitBeforeOpen.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: waiting ~${Math.round(wait1 / 1000)}s before Open`);
    await humanReadPage(page, { debug: cfg.debug, maxMs: 8000 * readMult });
    await humanMicroActions(page, wait1, { debug: cfg.debug });

    // Scan whole page and click Open button — YOUR EXACT CODE
    // Retry multiple times — STEP 1 MUST complete before proceeding
    let openButton = await findOpenButton(page, cfg.debug);
    let attempt = 1;
    while (!openButton && attempt < 4) {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: Open button not found (attempt ${attempt}), waiting...`);
      await sleep(4000);
      openButton = await findOpenButton(page, cfg.debug);
      attempt++;
    }
    if (!openButton) {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: Open button NOT FOUND after all attempts — STOPPING flow`);
      meta.step = 1; meta.error = 'step1_open_not_found';
      return meta; // STOP — do not proceed to Step 2
    }
    await maybeMisclick(page, openButton, cfg.debug);
    await hoverAndHesitate(page, openButton, cfg.debug);
    const clicked = await humanClick(page, openButton, { debug: cfg.debug });
    if (!clicked) {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: Open button click FAILED — STOPPING flow`);
      meta.step = 1; meta.error = 'step1_open_click_failed';
      return meta; // STOP
    }
    meta.clicked++; meta.step = 1;
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-1: Open button clicked SUCCESS`);

    // Small pause after click before next step
    await sleep(rand(1500, 2500));

    // ==================================================================
    // STEP 2: Wait 10-20sec, click Next, handle Scroll Down, wait 5-10sec
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    const wait2 = skew(config.step2WaitAfterOpen.min, config.step2WaitAfterOpen.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: waiting ~${Math.round(wait2 / 1000)}s after Open`);
    await humanPause(page, wait2, { debug: cfg.debug });

    await sleep(clampedRand(100, 300, 0.5));
    let nextButton = await findNextButton(page, cfg.debug);
    attempt = 1;
    while (!nextButton && attempt < 4) {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: Next button not found (attempt ${attempt}), waiting...`);
      await sleep(4000);
      nextButton = await findNextButton(page, cfg.debug);
      attempt++;
    }
    if (nextButton) {
      await hoverAndHesitate(page, nextButton, cfg.debug);
      const clicked2 = await humanClick(page, nextButton, { debug: cfg.debug });
      if (!clicked2) {
        if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: Next button click FAILED — STOPPING flow`);
        meta.step = 2; meta.error = 'step2_next_click_failed';
        return meta; // STOP
      }
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: Next button clicked SUCCESS`);
    } else {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: Next button NOT FOUND — STOPPING flow`);
      meta.step = 2; meta.error = 'step2_next_not_found';
      return meta; // STOP
    }

    // If "Scroll Down" appears, click it (optional)
    let scrollDownAppears = await checkScrollDown(page, cfg.debug);
    if (!scrollDownAppears) {
      await sleep(2000);
      scrollDownAppears = await checkScrollDown(page, cfg.debug);
    }
    if (scrollDownAppears) {
      await humanScroll(page, { maxBursts: 2, maxViewports: 1, debug: cfg.debug });
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: Scroll Down appeared, scrolled`);
    }

    const wait3 = skew(config.step2ScrollWait.min, config.step2ScrollWait.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-2: waiting ~${Math.round(wait3 / 1000)}s`);
    await humanPause(page, wait3, { debug: cfg.debug });
    meta.step = 2;

    // ==================================================================
    // STEP 3: Click Open, wait 3-13s, 67/100 probability scroll
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    let openButton2 = await findOpenButton(page, cfg.debug);
    attempt = 1;
    while (!openButton2 && attempt < 4) {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-3: Open button not found (attempt ${attempt}), waiting...`);
      await sleep(4000);
      openButton2 = await findOpenButton(page, cfg.debug);
      attempt++;
    }
    if (openButton2) {
      await hoverAndHesitate(page, openButton2, cfg.debug);
      const clicked3 = await humanClick(page, openButton2, { debug: cfg.debug });
      if (!clicked3) {
        if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-3: Open button click FAILED — STOPPING flow`);
        meta.step = 3; meta.error = 'step3_open_click_failed';
        return meta; // STOP
      }
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-3: Open button clicked SUCCESS`);
    } else {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-3: Open button NOT FOUND — STOPPING flow`);
      meta.step = 3; meta.error = 'step3_open_not_found';
      return meta; // STOP
    }

    // Wait 3-13sec (NO RELOAD here)
    const wait4 = skew(config.step3WaitAfterClick.min, config.step3WaitAfterClick.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-3: waiting ~${Math.round(wait4 / 1000)}s`);
    await humanPause(page, wait4, { debug: cfg.debug });

    // 67/100 probability — scroll down for more humanizing
    const probCheck = config.checkProbability(config.step3Probability);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-3: probability 67/100 → ${probCheck ? 'passed' : 'failed'}`);
    if (probCheck) {
      await humanScroll(page, { maxBursts: rand(2, 4), maxViewports: 2, debug: cfg.debug });
    } else {
      await humanMicroActions(page, rand(1000, 3000) * mult, { debug: cfg.debug });
    }
    meta.step = 3;

    // ==================================================================
    // STEP 4: Click Continue button, wait 3-7sec
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    let continueButton = await findContinueButton(page, cfg.debug);
    attempt = 1;
    while (!continueButton && attempt < 4) {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-4: Continue button not found (attempt ${attempt}), waiting...`);
      await sleep(4000);
      continueButton = await findContinueButton(page, cfg.debug);
      attempt++;
    }
    if (continueButton) {
      await hoverAndHesitate(page, continueButton, cfg.debug);
      const clicked4 = await humanClick(page, continueButton, { debug: cfg.debug });
      if (!clicked4) {
        if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-4: Continue button click FAILED — STOPPING flow`);
        meta.step = 4; meta.error = 'step4_continue_click_failed';
        return meta; // STOP
      }
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-4: Continue button clicked SUCCESS`);
    } else {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-4: Continue button NOT FOUND — STOPPING flow`);
      meta.step = 4; meta.error = 'step4_continue_not_found';
      return meta; // STOP
    }

    const wait5 = skew(config.step4WaitAfterContinue.min, config.step4WaitAfterContinue.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-4: waiting ~${Math.round(wait5 / 1000)}s`);
    await humanPause(page, wait5, { debug: cfg.debug });
    meta.step = 4;

    // ==================================================================
    // STEP 5: Click Go to Link button, wait 2-12sec
    // ==================================================================
    if (shouldBail(config.abandonment)) { meta.error = 'abandoned'; return meta; }

    let goToLinkButton = await findGoToLinkButton(page, cfg.debug);
    attempt = 1;
    while (!goToLinkButton && attempt < 4) {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-5: Go to Link button not found (attempt ${attempt}), waiting...`);
      await sleep(4000);
      goToLinkButton = await findGoToLinkButton(page, cfg.debug);
      attempt++;
    }
    if (goToLinkButton) {
      await hoverAndHesitate(page, goToLinkButton, cfg.debug);
      const clicked5 = await humanClick(page, goToLinkButton, { debug: cfg.debug });
      if (!clicked5) {
        if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-5: Go to Link button click FAILED — STOPPING flow`);
        meta.step = 5; meta.error = 'step5_goto_link_click_failed';
        return meta; // STOP
      }
      meta.clicked++;
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-5: Go to Link button clicked SUCCESS`);
    } else {
      if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-5: Go to Link button NOT FOUND — STOPPING flow`);
      meta.step = 5; meta.error = 'step5_goto_link_not_found';
      return meta; // STOP
    }

    const wait6 = skew(config.step5WaitAfterGoToLink.min, config.step5WaitAfterGoToLink.max);
    if (cfg.debug) console.log(`  tab[${tabIndex}] STEP-5: waiting ~${Math.round(wait6 / 1000)}s`);
    await humanPause(page, wait6, { debug: cfg.debug });
    meta.step = 5;

    // Mark as complete — all 5 steps done successfully
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
  // Navigate with domcontentloaded (fires early, doesn't block page loading)
  await page.goto(cfg.target, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((err) => {
    if (cfg.debug) console.log(`  tab[${tabIndex}] goto failed: ${err && err.message}`);
  });
  await sleep(clampedRand(500, 1200, 0.6));
}

async function hoverAndHesitate(page, el, debug) {
  try {
    // el is a Puppeteer element handle
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
/*  Button finders — YOUR EXACT CODE for every button                        */
/* ========================================================================= */

/**
 * Find Open button — YOUR EXACT CODE:
 * const allButtons = document.querySelectorAll('button');
 * const openButtons = [...allButtons].filter(button =>
 *     button.textContent.trim().toLowerCase() === 'open'
 * );
 */
async function findOpenButton(page, debug) {
  try {
    const allButtons = await page.$$('button');
    for (const btn of allButtons) {
      const text = await btn.evaluate((node) => node.textContent.trim().toLowerCase()).catch(() => '');
      if (text === 'open') {
        const box = await btn.boundingBox().catch(() => null);
        if (box && box.width > 0 && box.height > 0) {
          if (debug) console.log(`  findOpenButton: found at x=${box.x}, y=${box.y}`);
          return btn;
        }
      }
    }
    if (debug) console.log('  findOpenButton: no Open button found');
    return null;
  } catch (e) {
    if (debug) console.log('  findOpenButton error:', e && e.message);
    return null;
  }
}

/**
 * Find Next button — YOUR EXACT CODE:
 * const allButtons = document.querySelectorAll('button');
 * const nextButtons = [...allButtons].filter(button =>
 *     button.textContent.trim().toLowerCase() === 'next'
 * );
 */
async function findNextButton(page, debug) {
  try {
    const allButtons = await page.$$('button');
    for (const btn of allButtons) {
      const text = await btn.evaluate((node) => node.textContent.trim().toLowerCase()).catch(() => '');
      if (text === 'next') {
        const box = await btn.boundingBox().catch(() => null);
        if (box && box.width > 0 && box.height > 0) {
          if (debug) console.log(`  findNextButton: found at x=${box.x}, y=${box.y}`);
          return btn;
        }
      }
    }
    if (debug) console.log('  findNextButton: no Next button found');
    return null;
  } catch (e) {
    if (debug) console.log('  findNextButton error:', e && e.message);
    return null;
  }
}

/**
 * Check if "Scroll Down" appears — YOUR EXACT CODE pattern
 */
async function checkScrollDown(page, debug) {
  try {
    const allButtons = await page.$$('button');
    for (const btn of allButtons) {
      const text = await btn.evaluate((node) => node.textContent.trim().toLowerCase()).catch(() => '');
      if (text === 'scroll down' || text.includes('scroll down')) {
        const box = await btn.boundingBox().catch(() => null);
        if (box && box.width > 0 && box.height > 0) {
          if (debug) console.log('  checkScrollDown: Scroll Down element found');
          return true;
        }
      }
    }
    if (debug) console.log('  checkScrollDown: no Scroll Down element found');
    return false;
  } catch (e) {
    if (debug) console.log('  checkScrollDown error:', e && e.message);
    return false;
  }
}

/**
 * Find Continue button — YOUR EXACT CODE:
 * const allButtons = document.querySelectorAll('button');
 * const continueButtons = [...allButtons].filter(button =>
 *     button.textContent.trim().toLowerCase() === 'continue'
 * );
 */
async function findContinueButton(page, debug) {
  try {
    const allButtons = await page.$$('button');
    for (const btn of allButtons) {
      const text = await btn.evaluate((node) => node.textContent.trim().toLowerCase()).catch(() => '');
      if (text === 'continue') {
        const box = await btn.boundingBox().catch(() => null);
        if (box && box.width > 0 && box.height > 0) {
          if (debug) console.log(`  findContinueButton: found at x=${box.x}, y=${box.y}`);
          return btn;
        }
      }
    }
    if (debug) console.log('  findContinueButton: no Continue button found');
    return null;
  } catch (e) {
    if (debug) console.log('  findContinueButton error:', e && e.message);
    return null;
  }
}

/**
 * Find Go to Link button — YOUR EXACT CODE pattern with 'go to link'
 */
async function findGoToLinkButton(page, debug) {
  try {
    const allButtons = await page.$$('button');
    for (const btn of allButtons) {
      const text = await btn.evaluate((node) => node.textContent.trim().toLowerCase()).catch(() => '');
      if (text === 'go to link') {
        const box = await btn.boundingBox().catch(() => null);
        if (box && box.width > 0 && box.height > 0) {
          if (debug) console.log(`  findGoToLinkButton: found at x=${box.x}, y=${box.y}`);
          return btn;
        }
      }
    }
    if (debug) console.log('  findGoToLinkButton: no Go to Link button found');
    return null;
  } catch (e) {
    if (debug) console.log('  findGoToLinkButton error:', e && e.message);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Human "error" wrappers                                                    */
/* -------------------------------------------------------------------------- */

async function maybeMisclick(page, el, debug) {
  if (!chance(0.06)) return false;
  try {
    // el is a Puppeteer element handle
    const box = await el.boundingBox().catch(() => null);
    if (!box) return false;
    const mx = box.x + rand(-15, 15);
    const my = box.y + rand(-15, 15);
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
