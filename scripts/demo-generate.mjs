import pkg from '/usr/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
await context.addInitScript(() => {
  localStorage.setItem('taskMasterAISettings', JSON.stringify({ provider: 'codex', apiKey: '', model: '' }));
});
const page = await context.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForSelector('text=QuietList');
await page.getByRole('button', { name: /Generate to-do list from a project/ }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'docs/generate-modal.png' });

// Run a real folder scan on this project
await page.locator('input[placeholder*="wsl.localhost"]').fill('/home/rp/workspaces/task-master-current');
await page.getByRole('button', { name: /Generate tasks/ }).click();
await page.waitForSelector('text=/selected/', { timeout: 60000 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'docs/generate-results.png' });

// Add them and capture the parent-task-with-subtasks result
await page.getByRole('button', { name: /^Add \d+ task/ }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/generate-added.png' });

await browser.close();
console.log('saved docs/generate-modal.png + docs/generate-results.png');
