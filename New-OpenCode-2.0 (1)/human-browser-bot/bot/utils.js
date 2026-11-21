// utils.js — Utility functions for the human browser bot
// Added: waitForElement (polling), waitForNavigation (URL/DOM change), waitForTextChange

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => Math.random() * (max - min) + min;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const chance = (probability) => Math.random() < probability;

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Human-like delayed pause with optional micro-actions
 */
const humanPause = async (page, minMs, maxMs, options = {}) => {
  const total = rand(minMs, maxMs);
  if (options.debug) console.log(`  human pause ~${Math.round(total / 1000)}s`);
  if (!page || total < 400) { await sleep(total); return; }
  const started = Date.now();
  while (Date.now() - started < total) {
    const remaining = total - (Date.now() - started);
    if (remaining <= 0) break;
    const chunk = Math.min(rand(250, 1000), remaining);
    await sleep(chunk);
  }
};

/**
 * Wait until an element matching a Puppeteer selector appears on the page.
 * Polls every `interval` ms up to `timeout` ms. Returns the element handle or null.
 */
async function waitForElement(page, selector, { timeout = 15000, interval = 500, debug = false } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const el = await page.$(selector);
      if (el) {
        if (debug) console.log(`  waitForElement: found "${selector}" after ${Math.round(Date.now() - start)}ms`);
        return el;
      }
    } catch (_) {}
    await sleep(interval);
  }
  if (debug) console.log(`  waitForElement: "${selector}" NOT found within ${timeout}ms`);
  return null;
}

/**
 * Wait until the page URL changes from `currentUrl`.
 * Returns the new URL or null.
 */
async function waitForNavigation(page, currentUrl, { timeout = 15000, interval = 500, debug = false } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const url = await page.url();
      if (url && url !== currentUrl) {
        if (debug) console.log(`  waitForNavigation: URL changed to ${url} after ${Math.round(Date.now() - start)}ms`);
        return url;
      }
    } catch (_) {}
    await sleep(interval);
  }
  if (debug) console.log(`  waitForNavigation: URL did not change within ${timeout}ms`);
  return null;
}

/**
 * Wait until the visible text of buttons matching `patterns` changes from `previousTexts`.
 * Useful when a button says "Your link is being processed" and we need it to become clickable again.
 */
async function waitForButtonTextChange(page, patterns, previousTexts, { timeout = 20000, interval = 1000, debug = false } = {}) {
  const start = Date.now();
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
        const buttons = [...document.querySelectorAll('button, a, input[type="button"], input[type="submit"]')];
        const found = [];
        for (const btn of buttons) {
          const text = (btn.innerText || btn.textContent || btn.value || '').trim().toLowerCase();
          for (const p of pats) {
            const needle = p.replace(/^\^|\$$/g, '');
            if (text.includes(needle)) {
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                found.push({ text, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                break;
              }
            }
          }
        }
        return found;
      }, patStrings);
      if (result && result.length > 0) {
        const changed = result.some(b => !previousTexts.includes(b.text));
        if (changed) {
          if (debug) console.log(`  waitForButtonTextChange: button text changed after ${Math.round(Date.now() - start)}ms`);
          return result;
        }
      }
    } catch (_) {}
    await sleep(interval);
  }
  if (debug) console.log(`  waitForButtonTextChange: no text change within ${timeout}ms`);
  return null;
}

const humanPauseExport = humanPause;

module.exports = {
  rand,
  randFloat,
  sleep,
  chance,
  clamp,
  randomInt,
  humanPause: humanPauseExport,
  waitForElement,
  waitForNavigation,
  waitForButtonTextChange,
};
