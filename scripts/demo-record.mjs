import pkg from '/usr/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const W = 820, H = 920;
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: 'docs/_rec', size: { width: W, height: H } },
});
// Pre-configure AI to use the local Codex CLI (no key) so the ✨ button works live.
await context.addInitScript(() => {
  localStorage.setItem('taskMasterAISettings', JSON.stringify({ provider: 'codex', apiKey: '', model: '' }));
});

const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForSelector('text=QuietList');
await pause(1200);

// Peek the AI settings drawer (shows the multi-provider story)
await page.locator('button[title="AI settings"]').click();
await pause(1900);
await page.locator('div[class*="bg-black"]').click({ position: { x: 20, y: 20 } });
await pause(700);

// Type a goal and let AI break it down
const input = page.getByPlaceholder('What needs to be done?');
await input.click();
for (const ch of 'Plan a product launch') { await input.type(ch, { delay: 55 }); }
await pause(500);
await page.getByRole('button', { name: /Add \+ AI Subtasks/ }).click();

// Wait for the AI subtasks to appear under the new task
await page.waitForFunction(() => document.body.innerText.includes('Plan a product launch'), { timeout: 60000 });
await pause(6000); // let the "Thinking…" -> subtasks animation land

// Flair: toggle dark mode
await page.locator('button:has-text("🌙")').click();
await pause(1800);

await context.close();
await browser.close();
console.log('recorded to docs/_rec');
