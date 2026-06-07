import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Build a context-aware planning prompt from the task name, its notes, and any
// subtasks that already exist.
const buildPrompt = ({ goal, notes, existing, count }) => {
  const lines = [
    `You are an expert project planner. Break the task below into about ${count} subtasks`,
    `that, completed in order, finish it.`,
    ``,
    `Task: "${goal}"`,
  ];

  if (notes && notes.trim()) {
    lines.push(
      ``,
      `Notes for this task — use these details; they may name tools, constraints,`,
      `steps, or acceptance criteria, so the subtasks should reflect them:`,
      `"""`,
      notes.trim(),
      `"""`
    );
  }

  if (Array.isArray(existing) && existing.length) {
    lines.push(
      ``,
      `These subtasks already exist. Do NOT repeat them — only add what is missing:`,
      ...existing.map((s) => `- ${s}`)
    );
  }

  lines.push(
    ``,
    `Rules:`,
    `- Each subtask is one concrete action and starts with a verb.`,
    `- Order them logically, earliest first.`,
    `- Be specific to THIS task and its notes; no generic filler.`,
    `- No overlap, no duplicates, and do not restate the task itself.`,
    `- Keep each subtask under ~10 words.`,
    ``,
    `Return ONLY a JSON array of strings. No prose, no numbering, no markdown fences.`
  );

  return lines.join('\n');
};

// Pull the first JSON array out of model output and validate it.
function extractArray(text) {
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

// ---- providers ---------------------------------------------------------

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
      max_tokens: 512,
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

// ---- handler -----------------------------------------------------------

export async function POST(req) {
  try {
    const { provider, goal, notes, existing, model, apiKey, count = 5 } = await req.json();
    if (!goal || !goal.trim()) {
      return NextResponse.json({ error: 'Missing goal' }, { status: 400 });
    }
    const needsKey = ['anthropic', 'openai', 'groq', 'gemini'].includes(provider);
    if (needsKey && !apiKey) {
      return NextResponse.json({ error: `API key required for ${provider}` }, { status: 400 });
    }

    const prompt = buildPrompt({ goal, notes, existing, count });

    let raw = '';
    switch (provider) {
      case 'codex':
        raw = await callCodex(prompt, model);
        break;
      case 'ollama':
        raw = await callOllama(prompt, model);
        break;
      case 'anthropic':
        raw = await callAnthropic(prompt, model, apiKey);
        break;
      case 'openai':
        raw = await callOpenAICompat(
          'https://api.openai.com/v1/chat/completions',
          prompt, model, apiKey, 'gpt-5.4-mini'
        );
        break;
      case 'groq':
        raw = await callOpenAICompat(
          'https://api.groq.com/openai/v1/chat/completions',
          prompt, model, apiKey, 'openai/gpt-oss-120b'
        );
        break;
      case 'gemini':
        raw = await callGemini(prompt, model, apiKey);
        break;
      default:
        return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

    const arr = extractArray(raw);
    if (!arr) {
      return NextResponse.json({ error: 'Could not parse subtasks from model', raw }, { status: 502 });
    }
    const subtasks = arr
      .filter((x) => typeof x === 'string' && x.trim())
      .map((s) => s.trim())
      .slice(0, 8);
    return NextResponse.json({ subtasks });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
