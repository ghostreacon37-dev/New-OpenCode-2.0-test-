# Ubuntu Setup Guide for HumanBrowserBot

## Prerequisites (One-time setup)

### 1. Install Node.js and npm
```bash
sudo apt update
sudo apt install -y nodejs npm
node --version  # Should be v18+ (v20 recommended)
npm --version   # Should be v9+
```

### 2. Install Puppeteer dependencies (required for Chromium on Linux)
```bash
sudo apt install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  libatspi2.0-0
```

### 3. Transfer the bot folder to Ubuntu
Copy the entire `HumanBrowserBot` folder to your Ubuntu machine:
```bash
# Using scp (from Windows, replace with your IP):
scp -r C:/Users/Stormy/Documents/HumanBrowserBot user@ubuntu-ip:~/HumanBrowserBot

# Or using USB, git, etc.
```

### 4. Install Node dependencies
```bash
cd ~/HumanBrowserBot
npm install
```

### 5. Verify installation
```bash
node -e "const p = require('puppeteer'); console.log('Puppeteer OK:', p.executablePath());"
```

---

## Running on Ubuntu

### Basic Run (visible browser)
```bash
cd ~/HumanBrowserBot
node testbot.js https://your-site.com https://your-referrer.com/page --confirm-owned --headless=false --fixedInstances=1 --debug
```

### Headless Run (no visible window, faster)
```bash
node testbot.js https://your-site.com https://your-referrer.com/page --confirm-owned --fixedInstances=1
```

### With Proxy
```bash
node testbot.js https://your-site.com https://your-referrer.com/page --confirm-owned --proxy --proxy-file=proxies.txt --headless=false --fixedInstances=1
```

### Multiple Runs
```bash
node testbot.js https://your-site.com https://your-referrer.com/page --confirm-owned --runs=5 --interval=30000 --headless=false --fixedInstances=1
```

---

## Ubuntu-Specific Notes

### 1. X Server for Visible Browser
If you want to see the browser window (`--headless=false`), you need a display:
- **Desktop Ubuntu**: Works out of the box
- **Server Ubuntu (no GUI)**: Use Xvfb
  ```bash
  sudo apt install -y xvfb
  xvfb-run node testbot.js https://your-site.com https://your-referrer.com/page --confirm-owned --headless=false --fixedInstances=1
  ```

### 2. Puppeteer Chrome Path
If Puppeteer can't find Chrome, set the executable path:
```bash
# Find Chrome
which google-chrome
# or
which chromium-browser
# or
which chromium

# Set environment variable
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
node testbot.js ...
```

### 3. Permissions
Make sure the bot folder is writable:
```bash
chmod -R 755 ~/HumanBrowserBot
```

### 4. Screenshots
Screenshots are saved in the current working directory:
```bash
cd ~/HumanBrowserBot
ls screenshot_*.png
```

---

## Troubleshooting Ubuntu

### "Error: Failed to launch the browser process"
```bash
# Install missing dependencies
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0

# Or run with --no-sandbox (already in code)
```

### "Cannot find module 'puppeteer'"
```bash
cd ~/HumanBrowserBot
npm install
# If still failing:
npm install puppeteer --save
```

### "Display not found" / Headless issues
```bash
# Install Xvfb for virtual display
sudo apt install -y xvfb
# Run with xvfb-run
xvfb-run --auto-servernum node testbot.js https://your-site.com https://your-referrer.com/page --confirm-owned --headless=false --fixedInstances=1
```

### "Permission denied" on node_modules
```bash
sudo chown -R $USER:$USER ~/HumanBrowserBot
```

---

## File Paths on Ubuntu

All paths in the code use relative paths (`./`, `../`), so they work on both Windows and Ubuntu without modification.

The only thing that changes is where you run it from:
- Windows: `C:\Users\Stormy\Documents\HumanBrowserBot\`
- Ubuntu: `~/HumanBrowserBot/` (or wherever you put it)

---

## Quick Test on Ubuntu

```bash
cd ~/HumanBrowserBot
node -e "const cfg = require('./config.js'); console.log('Config OK:', cfg.step1WaitBeforeOpen);"
node -e "const fl = require('./bot/flows.js'); console.log('Flows OK:', Object.keys(fl));"
node -e "const ha = require('./bot/humanActions.js'); console.log('HumanActions OK:', Object.keys(ha).length + ' functions');"
```

All three should print "OK" without errors.