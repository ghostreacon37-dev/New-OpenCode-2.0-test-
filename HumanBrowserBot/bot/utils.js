// utils.js - Utility functions for HumanBrowserBot
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => Math.random() * (max - min) + min;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const chance = (probability) => Math.random() < probability;
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

module.exports = { rand, randFloat, sleep, chance, clamp };