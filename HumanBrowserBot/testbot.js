// testbot.js - Main entry point for HumanBrowserBot
// Usage: node testbot.js <target_url> <referrer_url> [options]

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { runTabFlow } = require('./bot/flows');
const { sleep, rand } = require('./bot/utils');
const cfg = require('./config');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { target: null, referrer: null, confirmOwned: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const [key, value] = args[i].slice(2).split('=');
      if (key === 'confirm-owned') result.confirmOwned = true;
      else if (key === 'debug') result.debug = true;
      else if (key === 'forever') result.forever = true;
      else if (key === 'proxy') result.proxyMode = true;
      else if (key === 'proxy-file') result.proxyFile = value;
      else if (key === 'ua-file') result.uaFile = value;
      else if (key === 'runs') result.runs = parseInt(value);
      else if (key === 'interval') result.interval = parseInt(value);
      else if (key === 'fixedInstances') result.fixedInstances = parseInt(value);
      else if (key === 'minTabs') result.minTabs = parseInt(value);
      else if (key === 'maxTabs') result.maxTabs = parseInt(value);
    } else if (!result.target) {
      result.target = args[i];
    } else if (!result.referrer) {
      result.referrer = args[i];
    }
  }
  result.runs = result.runs || 1;
  result.interval = result.interval || 30000;
  result.minTabs = result.minTabs || 2;
  result.maxTabs = result.maxTabs || 5;
  return result;
}

function usage() {
  return `Usage: node testbot.js <target_url> <referrer_url> [options]
Options: --confirm-owned (required), --debug, --runs=N, --interval=ms, --forever, --proxy, --proxy-file=F, --ua-file=F, --fixedInstances=N`;
}

async function main() {
  const cfg_parsed = parseArgs();
  if (!cfg_parsed.target || !cfg_parsed.referrer) {
    console.error(usage());
    process.exit(1);
  }
  if (!cfg_parsed.confirmOwned) {
    console.error('ERROR: This script requires --confirm-owned. Only run on domains you own or have permission to test.');
    process.exit(1);
  }

  const config = cfg;
  config.target = cfg_parsed.target;
  config.referrer = cfg_parsed.referrer;
  config.debug = cfg_parsed.debug || false;

  console.log('Starting HumanBrowserBot - target: ' + config.target + ', referrer: ' + config.referrer);
  console.log('Runs: ' + cfg_parsed.runs + (cfg_parsed.forever ? ' (forever)' : '') + ', interval=' + cfg_parsed.interval + 'ms');
  console.log('Proxy mode: ' + (cfg_parsed.proxyMode ? 'enabled' : 'disabled'));

  let run = 0;
  let stop = false;
  process.on('SIGINT', () => { console.log('\nSIGINT received - stopping after current run'); stop = true; });
  process.on('SIGTERM', () => { console.log('\nSIGTERM received - stopping after current run'); stop = true; });

  while (!stop && (cfg_parsed.forever || run < cfg_parsed.runs)) {
    run++;
    console.log('\n=== Run ' + run + ' ===');
    const tabCount = cfg_parsed.fixedInstances ? cfg_parsed.fixedInstances : rand(cfg_parsed.minTabs, cfg_parsed.maxTabs);
    const flows = [];
    for (let t = 0; t < tabCount; t++) {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      flows.push(runTabFlow({ page, cfg: config, run, tabIndex: t + 1 }));
      await sleep(rand(300, 1200));
    }
    const results = await Promise.allSettled(flows);
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        const v = r.value;
        console.log(' - tab' + v.tab + ': success=' + v.success + ' step=' + v.step + ' url=' + (v.finalUrl || 'N/A'));
      } else {
        console.log(' - tab failed:', r.reason);
      }
    });
    if (cfg_parsed.forever || run < cfg_parsed.runs) {
      if (stop) break;
      console.log('Waiting ' + cfg_parsed.interval + 'ms before next run...');
      await sleep(cfg_parsed.interval);
    }
  }
  console.log('All runs complete.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error:', e && e.message ? e.message : e);
  process.exit(1);
});