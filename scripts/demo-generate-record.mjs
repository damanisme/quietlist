import pkg from '/usr/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

// Records the "generate a whole to-do list from a project" flow (folder scan,
// local Codex provider, no key) → docs/_recgen/*.webm
const W = 820, H = 940;
const FOLDER = process.env.DEMO_FOLDER || '/home/rp/workspaces/ikigai';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: 'docs/_recgen', size: { width: W, height: H } },
});
await context.addInitScript(() => {
  localStorage.setItem('taskMasterAISettings', JSON.stringify({ provider: 'codex', apiKey: '', model: '' }));
});

const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForSelector('text=QuietList');
await pause(1100);

// Open the generator
await page.getByRole('button', { name: /Generate to-do list from a project/ }).click();
await pause(1100);

// Folder tab is default — type a project path, char by char for the camera
const input = page.locator('input[placeholder*="wsl.localhost"]');
await input.click();
for (const ch of FOLDER) { await input.type(ch, { delay: 28 }); }
await pause(700);

// Generate — AI reads the project's docs and proposes the tasks
await page.getByRole('button', { name: /Generate tasks/ }).click();
await page.waitForSelector('text=/selected/', { timeout: 60000 });
await pause(2600); // let the reviewer list settle so viewers can read it

// Add them — lands as one parent task with the items as subtasks
await page.getByRole('button', { name: /^Add \d+ task/ }).click();
await pause(3200);

await context.close();
await browser.close();
console.log('recorded to docs/_recgen');
