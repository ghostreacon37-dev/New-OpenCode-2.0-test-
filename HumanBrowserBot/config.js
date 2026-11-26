// HumanBrowserBot - config.js
// All timing parameters and configuration for the custom redirect method

// Wait time ranges (in milliseconds) - PATIENT VERSION (slower, more human-like)
const step1WaitBeforeOpen = { min: 15000, max: 90000 };   // 15-90 sec (was 5-60)
const step2WaitAfterOpen = { min: 20000, max: 45000 };     // 20-45 sec (was 10-25)
const step2ScrollWait = { min: 10000, max: 20000 };       // 10-20 sec (was 5-10)
const step3WaitAfterClick = { min: 8000, max: 25000 };    // 8-25 sec (was 3-13)
const step3Probability = 67;                               // 67/100 (unchanged)
const step4WaitAfterContinue = { min: 8000, max: 15000 }; // 8-15 sec (was 3-7)
const step5WaitAfterGoToLink = { min: 5000, max: 20000 }; // 5-20 sec (was 2-12)
const step6WaitBeforeBrowse = { min: 5000, max: 15000 };  // 5-15 sec (was 1-5)

// Humanization settings
const humanization = {
  overshootProbability: 0.25,
  minSteps: 8,
  maxSteps: 25,
  minSpeed: 0.7,
  maxSpeed: 1.3,
};

const debug = false;

module.exports = {
  step1WaitBeforeOpen,
  step2WaitAfterOpen,
  step2ScrollWait,
  step3WaitAfterClick,
  step3Probability,
  step4WaitAfterContinue,
  step5WaitAfterGoToLink,
  step6WaitBeforeBrowse,
  humanization,
  debug,
  randMinMax: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  checkProbability: (percentage) => Math.random() * 100 < percentage,
  upgrade: function(updates) {
    if (updates.step1WaitBeforeOpen) Object.assign(this.step1WaitBeforeOpen, updates.step1WaitBeforeOpen);
    if (updates.step2WaitAfterOpen) Object.assign(this.step2WaitAfterOpen, updates.step2WaitAfterOpen);
    if (updates.step2ScrollWait) Object.assign(this.step2ScrollWait, updates.step2ScrollWait);
    if (updates.step3WaitAfterClick) Object.assign(this.step3WaitAfterClick, updates.step3WaitAfterClick);
    if (updates.step3Probability) this.step3Probability = updates.step3Probability;
    if (updates.step4WaitAfterContinue) Object.assign(this.step4WaitAfterContinue, updates.step4WaitAfterContinue);
    if (updates.step5WaitAfterGoToLink) Object.assign(this.step5WaitAfterGoToLink, updates.step5WaitAfterGoToLink);
    if (updates.step6WaitBeforeBrowse) Object.assign(this.step6WaitBeforeBrowse, updates.step6WaitBeforeBrowse);
    if (updates.humanization) Object.assign(this.humanization, updates.humanization);
    if (updates.debug !== undefined) this.debug = updates.debug;
    return this;
  },
};