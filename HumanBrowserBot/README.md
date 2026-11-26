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

## Steps Executed (PATIENT VERSION - slower, more human-like)

1. Go to website, wait 15-90s, click Open button
2. Wait 20-45s, click Next, handle Scroll Down if appears, wait 10-20s
3. Click Open, reload site, 67/100 probability, scroll for humanize, wait 8-25s
4. Click Continue, wait 8-15s
5. Click Go to Link, wait 5-20s
6. Click Open Link, continue browse like human for 5-15s

## Testing Mode

- Only 1 tab opens (for testing)
- All waits are longer for more patient, human-like behavior
- Browser window opens (headless=false) so you can watch every click
- Micro-actions between steps (cursor wandering, tiny scrolls)
- Screenshots saved at each step

## Modular Customization

- Edit config.js to change all timing ranges
- Edit bot/flows.js to modify button detection text
- Edit bot/humanActions.js to change humanization settings
- Add proxies to proxies.txt
- Add user agents to uas.txt

## Location

C:\Users\Stormy\Documents\HumanBrowserBot\