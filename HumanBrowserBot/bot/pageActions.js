// pageActions.js - Main browser automation entry point
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { runTabFlow } = require('./flows');
const { sleep, rand } = require('./utils');

async function main() {
  const args = process.argv.slice(2);
  const targetUrl = args[0];
  const referrerUrl = args[1];
  const options = {};
  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value ? value : true;
    }
  }
  if (!targetUrl || !referrerUrl) {
    console.error('Usage: node pageActions.js <target_url> <referrer_url> [options]');
    console.error('Options: --debug, --confirm-owned, --runs=N, --interval=ms');
    process.exit(1);
  }
  if (options.confirmOwned !== true && options.c === undefined) {
    console.error('ERROR: This script requires --confirm-owned. Only run on domains you own or have permission to test.');
    process.exit(1);
  }
  const cfg = require('../config');
  cfg.target = targetUrl;
  cfg.referrer = referrerUrl;
  cfg.debug = options.debug || false;

  console.log('Starting HumanBrowserBot - target: ' + cfg.target);
  console.log('Referrer: ' + cfg.referrer);
  console.log('Runs: ' + (options.runs || 1) + (options.forever ? ' (forever)' : ''));
  console.log('Debug mode: ' + cfg.debug);

  const browser = await puppeteer.launch({
    headless: options.headless !== false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let run = 0;
  const totalRuns = options.forever ? Infinity : (options.runs || 1);
  while (!options.forever || run < totalRuns) {
    run++;
    console.log('\n=== Run ' + run + ' ===');
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    const result = await runTabFlow({ page, cfg, run, tabIndex: 1 });
    console.log('  Run ' + run + ' result: tab' + result.tab + ' success=' + result.success + ' step=' + result.step);
    console.log('  Final URL: ' + await page.url());
    await page.close();
    if (options.forever || run < totalRuns) {
      const interval = options.interval || 30000;
      console.log('Waiting ' + interval + 'ms before next run...');
      await sleep(interval);
    }
  }
  console.log('All runs complete.');
  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error:', e && e.message ? e.message : e);
  process.exit(1);
});