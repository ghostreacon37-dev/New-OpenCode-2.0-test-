// human-browser-bot — config.js
// Custom redirect method — robust, human-like, retry-capable version
// Timing matches the original repo with your requested adjustments.

// ┌─────────────────────────────────────────────────────────────────────┐
// │ Step timing (milliseconds)                                          │
// └─────────────────────────────────────────────────────────────────────┘
const step1WaitBeforeOpen = { min: 5000,  max: 15000 };
const step2WaitAfterOpen  = { min: 10000, max: 20000 };
const step2ScrollWait     = { min: 5000,  max: 10000 };
const step3WaitAfterClick = { min: 3000,  max: 13000 };
const step3Probability    = 67; // 67 out of 100
const step4WaitAfterContinue = { min: 3000, max: 7000 };
const step5WaitAfterGoToLink = { min: 2000, max: 12000 };

// Page load timeout (73 seconds max wait for page to fully load)
const pageLoadTimeout = 73000;

// ┌─────────────────────────────────────────────────────────────────────┐
// │ Button text patterns per step                                       │
// │ Matched case-insensitively (substring or RegExp).                   │
// │ Buttons now change text dynamically (e.g. "Your link is being      │
// │ processed"), so we match multiple variants and poll for them.       │
// └─────────────────────────────────────────────────────────────────────┘
const step1ButtonPatterns = [
  'open', 'your link is being processed', 'processing', 'please wait',
  'start', 'go', 'begin', 'launch',
  /open/i, /processing/i, /please wait/i, /your link/i, /start/i, /go/i,
];
const step2ButtonPatterns = [
  'next', 'continue', 'proceed', 'go', 'skip', 'next step',
  /next/i, /continue/i, /proceed/i, /skip/i,
];
const scrollDownPatterns = [
  'scroll down', 'scroll', 'down', 'see more', 'load more', 'show more',
  /scroll down/i, /scroll/i, /see more/i, /load more/i,
];
const step3ButtonPatterns = [
  'open', 'your link is being processed', 'processing', 'please wait',
  'start', 'go', 'reload', 'again',
  /open/i, /processing/i, /please wait/i, /reload/i,
];
const step4ButtonPatterns = [
  'continue', 'proceed', 'next', 'go', 'ok', 'got it', 'done', 'finish',
  /continue/i, /proceed/i, /got it/i,
];
const step5ButtonPatterns = [
  'go to link', 'goto link', 'visit', 'open link', 'click here', 'continue',
  'go', 'redirect', 'take me there',
  /go to link/i, /goto/i, /visit/i, /open link/i, /click here/i, /redirect/i,
];

// ┌─────────────────────────────────────────────────────────────────────┐
// │ Retry / polling / navigation config                                 │
// └─────────────────────────────────────────────────────────────────────┘
const buttonPollInterval   = 500;   // ms between polls when hunting a button
const buttonFindTimeout    = 25000; // max ms to wait for a button to appear
const clickRetries         = 3;     // how many times to retry a click
const navigationWaitTimeout= 15000; // ms to wait for URL/DOM change after click
const screenshotOnFailure  = true;  // save screenshot when a step fails
const screenshotDir        = './screenshots';

// ┌─────────────────────────────────────────────────────────────────────┐
// │ Mouse movement humanization                                         │
// └─────────────────────────────────────────────────────────────────────┘
const humanization = {
  overshootProbability: 0.25,
  minSteps: 8,
  maxSteps: 25,
  minSpeed: 0.7,
  maxSpeed: 1.3,
  jitterChance: 0.15,
  midMovePauseChance: 0.10,
  preClickHesitateChance: 0.20,
};

// ┌─────────────────────────────────────────────────────────────────────┐
// │ Reading / browsing behavior                                         │
// └─────────────────────────────────────────────────────────────────────┘
const reading = {
  wpmMin: 200,
  wpmMax: 300,
  reReadChance: 0.15,
  textSelectionChance: 0.20,
  tabSwitchChance: 0.08,
  windowBlurChance: 0.06,
};

// ┌─────────────────────────────────────────────────────────────────────┐
// │ Abandonment (humans sometimes quit early)                           │
// └─────────────────────────────────────────────────────────────────────┘
const abandonment = {
  perStepBailChance: 0.03,
  earlyExitChance: 0.10,
};

// ┌─────────────────────────────────────────────────────────────────────┐
// │ Speed presets                                                       │
// └─────────────────────────────────────────────────────────────────────┘
const SPEED_PRESETS = {
  slow:   { multiplier: 1.4, readMultiplier: 1.3 },
  normal: { multiplier: 1.0, readMultiplier: 1.0 },
  fast:   { multiplier: 0.6, readMultiplier: 0.5 },
};

// Debug mode
const debug = false;

// ┌─────────────────────────────────────────────────────────────────────┐
// │ Helpers                                                             │
// └─────────────────────────────────────────────────────────────────────┘
const randMinMax = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => Math.random() * (max - min) + min;
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
const checkProbability = (percentage) => Math.random() * 100 < percentage;
const randSkewed = (min, max, skew = 0.5) => {
  const u = Math.random();
  const t = Math.pow(u, skew);
  return Math.floor(min + t * (max - min));
};

// ┌─────────────────────────────────────────────────────────────────────┐
// │ CLI argument parsing                                                │
// └─────────────────────────────────────────────────────────────────────┘
function parseArgs() {
  const args = process.argv.slice(2);
  const cfg = {
    target: null,
    referrer: null,
    confirmOwned: false,
    debug: false,
    runs: 1,
    forever: false,
    interval: 20000,
    fixedInstances: null,
    minTabs: 1,
    maxTabs: 3,
    oneBrowserPerTab: false,
    proxyMode: false,
    proxyFile: null,
    proxyRotation: false,
    uaFile: null,
    headless: true,
    randomViewport: true,
    speed: 'normal',
    noScreenshot: false,
  };

  let positional = 0;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--confirm-owned' || arg === '-c') { cfg.confirmOwned = true; continue; }
    if (arg === '--debug') { cfg.debug = true; continue; }
    if (arg === '--forever') { cfg.forever = true; continue; }
    if (arg === '--one-browser-per-tab') { cfg.oneBrowserPerTab = true; continue; }
    if (arg === '--proxy') { cfg.proxyMode = true; continue; }
    if (arg === '--proxy-rotation') { cfg.proxyRotation = true; continue; }
    if (arg === '--no-random-viewport') { cfg.randomViewport = false; continue; }
    if (arg === '--no-screenshot') { cfg.noScreenshot = true; continue; }

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      const val = value !== undefined ? value : args[i + 1];
      if (value === undefined) i++;
      switch (key) {
        case 'target': cfg.target = val; break;
        case 'referrer': cfg.referrer = val; break;
        case 'runs': cfg.runs = parseInt(val, 10) || 1; break;
        case 'interval': cfg.interval = parseInt(val, 10) || 20000; break;
        case 'fixed-instances': cfg.fixedInstances = parseInt(val, 10) || null; break;
        case 'min-tabs': cfg.minTabs = parseInt(val, 10) || 1; break;
        case 'max-tabs': cfg.maxTabs = parseInt(val, 10) || 3; break;
        case 'proxy-file': cfg.proxyFile = val; cfg.proxyMode = true; break;
        case 'ua-file': cfg.uaFile = val; break;
        case 'headless': cfg.headless = val !== 'false'; break;
        case 'speed': cfg.speed = val || 'normal'; break;
        default:
          if (cfg.debug) console.log(`  Unknown option: --${key}`);
      }
      continue;
    }

    if (positional === 0) { cfg.target = arg; positional++; }
    else if (positional === 1) { cfg.referrer = arg; positional++; }
  }

  return cfg;
}

function usage() {
  return `
Usage: node testbot.js <target_url> <referrer_url> [options]

Robust custom redirect method (5 steps):
  Step 1: Go to website, wait 5-15s, click Open (polls for button)
  Step 2: Wait 10-20s, click Next, optional Scroll Down, wait 5-10s
  Step 3: Click Open, reload site, 67/100 probability scroll, wait 3-13s
  Step 4: Click Continue, wait 3-7s
  Step 5: Click Go to Link, wait 2-12s

Options:
  --confirm-owned        Required. Confirm you own or have permission to test the domain.
  --debug                Enable debug logging.
  --forever              Run indefinitely (until SIGINT/SIGTERM).
  --runs=N               Number of runs (default: 1).
  --interval=ms          Wait ms between runs (default: 20000).
  --min-tabs=N           Min tabs per run (default: 1).
  --max-tabs=N           Max tabs per run (default: 3).
  --fixed-instances=N    Fixed browser instances instead of random tabs.
  --one-browser-per-tab  Separate browser per tab (allows per-tab proxies).
  --proxy                Enable proxy mode.
  --proxy-file=file      Proxy list file (enables proxy mode).
  --proxy-rotation       Rotate proxies between runs/tabs.
  --ua-file=file         Custom user-agent profiles file.
  --headless=false       Show browser window.
  --no-random-viewport   Fixed 1366x768 viewport.
  --no-screenshot        Disable screenshots on failure.
  --speed=slow|normal|fast  Execution speed preset (default: normal).

Example:
  node testbot.js https://example.com https://referrer.example.com/page --confirm-owned --debug --headless=false --speed=normal
`;
}

module.exports = {
  step1WaitBeforeOpen,
  step2WaitAfterOpen,
  step2ScrollWait,
  step3WaitAfterClick,
  step3Probability,
  step4WaitAfterContinue,
  step5WaitAfterGoToLink,
  pageLoadTimeout,
  humanization,
  reading,
  abandonment,
  SPEED_PRESETS,
  debug,
  randMinMax,
  randFloat,
  randSkewed,
  checkProbability,
  clamp,
  // Button patterns
  step1ButtonPatterns,
  step2ButtonPatterns,
  scrollDownPatterns,
  step3ButtonPatterns,
  step4ButtonPatterns,
  step5ButtonPatterns,
  // Retry / nav config
  buttonPollInterval,
  buttonFindTimeout,
  clickRetries,
  navigationWaitTimeout,
  screenshotOnFailure,
  screenshotDir,
  // CLI
  parseArgs,
  usage,
};
