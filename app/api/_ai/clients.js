// Shared server-only AI client helpers used by /api/ai/* routes.
// (Folder name is _ai so Next.js treats it as a private, non-routable folder.)
import { execFile } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';

export const KEY_PROVIDERS = ['anthropic', 'openai', 'groq', 'gemini'];
export const needsKey = (provider) => KEY_PROVIDERS.includes(provider);

// Pull the first JSON array out of model output and validate it.
export function extractArray(text) {
  if (!text) return null;
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j)) return j;
  } catch {}
  const m = text.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      if (Array.isArray(j)) return j;
    } catch {}
  }
  return null;
}

// Normalize a model's array output into clean short strings.
export function cleanList(arr, max = 12) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => typeof x === 'string' && x.trim())
    .map((s) => s.trim())
    .slice(0, max);
}

async function callCodex(prompt, model) {
  const tmp = path.join(os.tmpdir(), `tm-ai-${process.pid}-${Math.round(performance.now())}.txt`);
  const args = ['exec', '--skip-git-repo-check', '-o', tmp];
  if (model) args.push('-m', model);
  args.push(prompt);
  await new Promise((resolve, reject) => {
    const child = execFile('codex', args, { timeout: 55000 }, (err) => (err ? reject(err) : resolve()));
    // Codex reads from stdin when not on a TTY; close it so it uses the prompt arg only.
    if (child.stdin) child.stdin.end();
  });
  const out = await readFile(tmp, 'utf8').catch(() => '');
  unlink(tmp).catch(() => {});
  return out;
}

async function callOllama(prompt, model) {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      stream: false,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const d = await res.json();
  return d.message?.content || '';
}

async function callAnthropic(prompt, model, key) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.content?.[0]?.text || '';
}

async function callOpenAICompat(url, prompt, model, key, defModel) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model || defModel,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || '';
}

async function callGemini(prompt, model, key) {
  const m = model || 'gemini-3.5-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Dispatch a prompt to the chosen provider and return its raw text.
export async function runProvider({ provider, prompt, model, apiKey }) {
  switch (provider) {
    case 'codex':
      return callCodex(prompt, model);
    case 'ollama':
      return callOllama(prompt, model);
    case 'anthropic':
      return callAnthropic(prompt, model, apiKey);
    case 'openai':
      return callOpenAICompat('https://api.openai.com/v1/chat/completions', prompt, model, apiKey, 'gpt-5.4-mini');
    case 'groq':
      return callOpenAICompat('https://api.groq.com/openai/v1/chat/completions', prompt, model, apiKey, 'openai/gpt-oss-120b');
    case 'gemini':
      return callGemini(prompt, model, apiKey);
    default:
      throw new Error('Unknown provider');
  }
}
