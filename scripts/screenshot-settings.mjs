import pkg from '/usr/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.click('text=AI setup');
await page.waitForTimeout(300);
await page.click('button:has-text("GPT")');
await page.waitForTimeout(200);
await page.locator('input[list^="models-"]').click(); // open the suggestions list
await page.waitForTimeout(400);
await page.screenshot({ path: 'docs/settings.png' });
await browser.close();
console.log('saved docs/settings.png');
