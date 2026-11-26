# HumanBrowserBot

Modular human-like browser automation bot - custom redirect method replacement for x.com-style redirects.

## Quick Start

1. Install dependencies:
   npm install

2. Run the bot:
   node testbot.js https://your-target.com https://your-referrer.com/page --confirm-owned

3. With debug output:
   node testbot.js https://your-target.com https://your-referrer.com/page --confirm-owned --debug

## Project Structure

- config.js - All timing ranges and 67/100 probability
- bot/humanActions.js - Human-like mouse/click/scroll functions
- bot/flows.js - Steps 1-6 orchestration
- bot/pageActions.js - Main browser automation entry point
- bot/utils.js - Random utilities (rand, sleep, chance, clamp)
- testbot.js - Main entry point

## Steps Executed

1. Go to website, wait 5-60s, click Open button
2. Wait 10-25s, click Next, handle Scroll Down if appears, wait 5-10s
3. Click Open, reload site, 67/100 probability, scroll for humanize, wait 3-13s
4. Click Continue, wait 3-7s
5. Click Go to Link, wait 2-12s
6. Click Open Link, continue browse like human for 3-15s

## Modular Customization

- Edit config.js to change all timing ranges
- Edit bot/flows.js to modify button detection text
- Edit bot/humanActions.js to change humanization settings
- Add proxies to proxies.txt
- Add user agents to uas.txt

## Location

C:\Users\Stormy\Documents\HumanBrowserBot\