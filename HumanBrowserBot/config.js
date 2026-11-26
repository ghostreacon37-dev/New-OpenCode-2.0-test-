// HumanBrowserBot - config.js
// All timing parameters and configuration for the custom redirect method

// Wait time ranges (in milliseconds)
const step1WaitBeforeOpen = { min: 5000, max: 60000 };   // 5-60 sec
const step2WaitAfterOpen = { min: 10000, max: 25000 };    // 10-25 sec
const step2ScrollWait = { min: 5000, max: 10000 };        // 5-10 sec
const step3WaitAfterClick = { min: 3000, max: 13000 };    // 3-13 sec
const step3Probability = 67;                               // 67/100
const step4WaitAfterContinue = { min: 3000, max: 7000 };  // 3-7 sec
const step5WaitAfterGoToLink = { min: 2000, max: 12000 }; // 2-12 sec
const step6WaitBeforeBrowse = { min: 1000, max: 5000 };   // 1-5 sec

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