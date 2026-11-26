// flows.js - Step orchestration for HumanBrowserBot
const { humanClick, humanScroll, humanMicroActions, humanHover, humanTextSelection } = require('./humanActions');
const cfg = require('../config');

async function runTabFlow({ page, cfg: passedCfg, run, tabIndex }) {
  const started = Date.now();
  const cfg = passedCfg || require('../config');
  let refClicked = false;

  // STEP 1: Go to website and wait, then click Open
  try {
    await page.goto(cfg.target, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((err) => {
      if (cfg.debug) console.log('tab[' + tabIndex + '] goto failed: ' + (err && err.message));
    });
    // Take screenshot of initial page
    try {
      await page.screenshot({ path: 'screenshot_start_' + Date.now() + '.png' });
      console.log('  [SCREENSHOT] Initial page saved');
    } catch (e) {}
    const wait1 = cfg.randMinMax(cfg.step1WaitBeforeOpen.min, cfg.step1WaitBeforeOpen.max);
    if (cfg.debug) console.log('  step-1 wait ~' + Math.round(wait1 / 1000) + 's before Open');
    await humanMicroActions(page, wait1, { debug: cfg.debug });
    const openButton = await findOpenButton(page, cfg.debug);
    if (!openButton) {
      if (cfg.debug) console.log('  step-1: Open button not found');
      console.log('  [STEP 1] No Open button found - trying to scan all buttons...');
      const allBtns = await page.$$('button, a').catch(() => []);
      console.log('  [STEP 1] Found ' + allBtns.length + ' buttons/links on page');
      // Take screenshot for debugging
      try {
        await page.screenshot({ path: 'screenshot_step1_' + Date.now() + '.png' });
        console.log('  [STEP 1] Screenshot saved: screenshot_step1_' + Date.now() + '.png');
      } catch (e) {}
      return { tab: tabIndex, success: false, step: 1 };
    }
    console.log('  [STEP 1] Found Open button! Clicking it...');
    const clicked = await humanClick(page, openButton, { debug: cfg.debug });
    if (!clicked) {
      console.log('  [STEP 1] Failed to click Open button');
      return { tab: tabIndex, success: false, step: 1 };
    }
    console.log('  [STEP 1] ✅ Open button CLICKED successfully!');
    const wait2 = cfg.randMinMax(cfg.step2WaitAfterOpen.min, cfg.step2WaitAfterOpen.max);
    if (cfg.debug) console.log('  step-2 wait ~' + Math.round(wait2 / 1000) + 's after Open');
    await humanMicroActions(page, wait2, { debug: cfg.debug });
    const nextButton = await findNextButton(page, cfg.debug);
    if (nextButton) {
      console.log('  [STEP 2] Found Next button! Clicking it...');
      await humanClick(page, nextButton, { debug: cfg.debug });
      console.log('  [STEP 2] ✅ Next button CLICKED!');
    } else {
      console.log('  [STEP 2] No Next button found on page');
    }
    const scrollDownAppears = await checkScrollDown(page, cfg.debug);
    if (scrollDownAppears) {
      console.log('  [STEP 2] Scroll Down appeared! Scrolling down...');
      await humanScroll(page, { maxBursts: 3, maxViewports: 1 });
      console.log('  [STEP 2] ✅ Scrolled down!');
    } else {
      console.log('  [STEP 2] No Scroll Down element found');
    }
    const wait3 = cfg.randMinMax(cfg.step2ScrollWait.min, cfg.step2ScrollWait.max);
    if (cfg.debug) console.log('  step-2 extra wait ~' + Math.round(wait3 / 1000) + 's');
    await sleep(wait3);
  } catch (e) {
    if (cfg.debug) console.log('  step-1/2 error:', e && (e.message || e));
    return { tab: tabIndex, success: false, step: 1, error: e && e.message };
  }

  // STEP 3: Click Open, reload, 67/100 probability
  try {
    const openButton2 = await findOpenButton(page, cfg.debug);
    if (openButton2) {
      console.log('  [STEP 3] Found Open button again! Clicking...');
      await humanClick(page, openButton2, { debug: cfg.debug });
      console.log('  [STEP 3] ✅ Open button CLICKED!');
    } else {
      console.log('  [STEP 3] No Open button found');
    }
    console.log('  [STEP 3] Reloading page...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    console.log('  [STEP 3] Page reloaded!');
    const probCheck = cfg.checkProbability(cfg.step3Probability);
    console.log('  [STEP 3] Probability check: ' + cfg.step3Probability + '% -> ' + (probCheck ? 'PASSED ✅' : 'FAILED ❌'));
    if (probCheck) {
      console.log('  [STEP 3] Scrolling for humanize...');
      await humanScroll(page, { maxBursts: rand(2, 5), maxViewports: 2 });
      console.log('  [STEP 3] ✅ Scrolled for humanize!');
    } else {
      console.log('  [STEP 3] Skipping scroll (probability failed)');
    }
    const wait4 = cfg.randMinMax(cfg.step3WaitAfterClick.min, cfg.step3WaitAfterClick.max);
    if (cfg.debug) console.log('  step-3 wait ~' + Math.round(wait4 / 1000) + 's');
    await sleep(wait4);
  } catch (e) {
    if (cfg.debug) console.log('  step-3 error:', e && (e.message || e));
  }

  // STEP 4: Click Continue + wait
  try {
    const continueButton = await findContinueButton(page, cfg.debug);
    if (continueButton) {
      console.log('  [STEP 4] Found Continue button! Clicking...');
      await humanClick(page, continueButton, { debug: cfg.debug });
      console.log('  [STEP 4] ✅ Continue button CLICKED!');
    } else {
      console.log('  [STEP 4] No Continue button found');
    }
    const wait5 = cfg.randMinMax(cfg.step4WaitAfterContinue.min, cfg.step4WaitAfterContinue.max);
    if (cfg.debug) console.log('  step-4 wait ~' + Math.round(wait5 / 1000) + 's');
    await sleep(wait5);
  } catch (e) {
    if (cfg.debug) console.log('  step-4 error:', e && (e.message || e));
  }

  // STEP 5: Click Go to Link + wait
  try {
    const goToLinkButton = await findGoToLinkButton(page, cfg.debug);
    if (goToLinkButton) {
      console.log('  [STEP 5] Found Go to Link button! Clicking...');
      await humanClick(page, goToLinkButton, { debug: cfg.debug });
      console.log('  [STEP 5] ✅ Go to Link button CLICKED!');
    } else {
      console.log('  [STEP 5] No Go to Link button found');
    }
    const wait6 = cfg.randMinMax(cfg.step5WaitAfterGoToLink.min, cfg.step5WaitAfterGoToLink.max);
    if (cfg.debug) console.log('  step-5 wait ~' + Math.round(wait6 / 1000) + 's');
    await sleep(wait6);
  } catch (e) {
    if (cfg.debug) console.log('  step-5 error:', e && (e.message || e));
  }

  // STEP 6: Click Open Link + continue browse like human
  try {
    const openLinkButton = await findOpenLinkButton(page, cfg.debug);
    if (openLinkButton) {
      console.log('  [STEP 6] Found Open Link button! Clicking...');
      await humanClick(page, openLinkButton, { debug: cfg.debug });
      console.log('  [STEP 6] ✅ Open Link button CLICKED!');
    } else {
      console.log('  [STEP 6] No Open Link button found');
    }
    const browseDuration = cfg.randMinMax(3000, 15000);
    if (cfg.debug) console.log('  step-6: Browsing for ~' + Math.round(browseDuration / 1000) + 's like a real human');
    await humanMicroActions(page, browseDuration, { debug: cfg.debug });
  } catch (e) {
    if (cfg.debug) console.log('  step-6 error:', e && (e.message || e));
  }

  return { tab: tabIndex, success: true, step: 6 };
}

async function findOpenButton(page, debug) {
  try {
    const buttons = await page.$$('button, a').catch(() => []);
    for (const btn of buttons) {
      try {
        const text = await btn.evaluate((node) => node.innerText || node.textContent || '').catch(() => '');
        const lowerText = text.toLowerCase().trim();
        if (lowerText.includes('open') || lowerText.includes('go') || lowerText.includes('start')) {
          const box = await btn.boundingBox();
          if (box && box.width > 50 && box.height > 5) { return btn; }
        }
      } catch (_) {}
    }
    const allButtons = await page.$$('button');
    if (allButtons.length) return allButtons[0];
    return null;
  } catch (e) {
    if (debug) console.log('  findOpenButton error:', e && e.message);
    return null;
  }
}

async function findNextButton(page, debug) {
  try {
    const buttons = await page.$$('button, a').catch(() => []);
    for (const btn of buttons) {
      try {
        const text = await btn.evaluate((node) => node.innerText || node.textContent || '').catch(() => '');
        const lowerText = text.toLowerCase().trim();
        if (lowerText.includes('next')) {
          const box = await btn.boundingBox();
          if (box && box.width > 50 && box.height > 5) { return btn; }
        }
      } catch (_) {}
    }
    return null;
  } catch (e) {
    if (debug) console.log('  findNextButton error:', e && e.message);
    return null;
  }
}

async function checkScrollDown(page, debug) {
  try {
    const elements = await page.$$('div, span, p, a, button').catch(() => []);
    for (const el of elements) {
      try {
        const text = await el.evaluate((node) => node.innerText || node.textContent || '').catch(() => '');
        const lowerText = text.toLowerCase().trim();
        if (lowerText.includes('scroll down') || lowerText.includes('scroll') || lowerText.includes('down')) {
          const box = await el.boundingBox();
          if (box && box.width > 50 && box.height > 5) { return true; }
        }
      } catch (_) {}
    }
    return false;
  } catch (e) {
    if (debug) console.log('  checkScrollDown error:', e && e.message);
    return false;
  }
}

async function findContinueButton(page, debug) {
  try {
    const elements = await page.$$('button, a, div, span').catch(() => []);
    for (const el of elements) {
      try {
        const text = await el.evaluate((node) => node.innerText || node.textContent || '').catch(() => '');
        const lowerText = text.toLowerCase().trim();
        if (lowerText.includes('continue')) {
          const box = await el.boundingBox();
          if (box && box.width > 50 && box.height > 5) { return el; }
        }
      } catch (_) {}
    }
    return null;
  } catch (e) {
    if (debug) console.log('  findContinueButton error:', e && e.message);
    return null;
  }
}

async function findGoToLinkButton(page, debug) {
  try {
    const elements = await page.$$('button, a').catch(() => []);
    for (const el of elements) {
      try {
        const text = await el.evaluate((node) => node.innerText || node.textContent || '').catch(() => '');
        const lowerText = text.toLowerCase().trim();
        if (lowerText.includes('go to link') || lowerText.includes('goto') || lowerText.includes('visit')) {
          const box = await el.boundingBox();
          if (box && box.width > 50 && box.height > 5) { return el; }
        }
      } catch (_) {}
    }
    return null;
  } catch (e) {
    if (debug) console.log('  findGoToLinkButton error:', e && e.message);
    return null;
  }
}

async function findOpenLinkButton(page, debug) {
  try {
    const elements = await page.$$('button, a').catch(() => []);
    for (const el of elements) {
      try {
        const text = await el.evaluate((node) => node.innerText || node.textContent || '').catch(() => '');
        const lowerText = text.toLowerCase().trim();
        if (lowerText.includes('open link') || lowerText.includes('open')) {
          const box = await el.boundingBox();
          if (box && box.width > 50 && box.height > 5) { return el; }
        }
      } catch (_) {}
    }
    const clickable = await page.$$('button, a[href]').catch(() => []);
    if (clickable.length) return clickable[0];
    return null;
  } catch (e) {
    if (debug) console.log('  findOpenLinkButton error:', e && e.message);
    return null;
  }
}

module.exports = { runTabFlow };