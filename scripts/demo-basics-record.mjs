import pkg from '/usr/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

// Records the everyday flow: add a task, set priority, check one off, run the
// Pomodoro timer, toggle dark mode → docs/_recbasics/*.webm
const W = 820, H = 940;

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: 'docs/_recbasics', size: { width: W, height: H } },
});
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const type = async (loc, text, delay = 45) => { await loc.click(); for (const ch of text) await loc.type(ch, { delay }); };

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForSelector('text=QuietList');
await pause(1100);

// Add a task with a priority
const input = page.getByPlaceholder('What needs to be done?');
await type(input, 'Write launch blog post');
await pause(300);
await page.locator('select').first().selectOption({ label: 'High' }).catch(() => {});
await pause(400);
await page.getByRole('button', { name: /^Add Task$/ }).click();
await pause(900);

// Add a second one quickly
await type(input, 'Email early users');
await page.getByRole('button', { name: /^Add Task$/ }).click();
await pause(900);

// Check one off — satisfying strike-through (top task is the newest)
await page.locator('input[type="checkbox"]').first().click();
await pause(1500);

// Pomodoro: start the timer, then peek a break preset
await page.locator('button:has-text("Start")').click();
await pause(2200);
await page.getByRole('button', { name: /Short Break/ }).click();
await pause(1500);
await page.getByRole('button', { name: /Pomodoro \(25m\)/ }).click();
await pause(1200);

// Flair: dark mode
await page.locator('button:has-text("🌙")').click();
await pause(2000);

await context.close();
await browser.close();
console.log('recorded to docs/_recbasics');
