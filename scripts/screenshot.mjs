import pkg from '/usr/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const url = process.env.URL || 'http://localhost:3000';
const out = process.env.OUT || 'docs/screenshot.png';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1000, height: 1200 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
// Fresh context => empty localStorage => the built-in default tasks show.
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Task Master');
await page.waitForTimeout(800);
// Crop tight to the app card instead of the vertically-centered full page.
const card = page.locator('div.max-w-2xl').first();
await card.screenshot({ path: out });
await browser.close();
console.log('saved', out);
