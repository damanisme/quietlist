import { NextResponse } from 'next/server';
import { runProvider, extractArray, cleanList, needsKey } from '../../_ai/clients';

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

export async function POST(req) {
  try {
    const { provider, goal, notes, existing, model, apiKey, count = 5 } = await req.json();
    if (!goal || !goal.trim()) {
      return NextResponse.json({ error: 'Missing goal' }, { status: 400 });
    }
    if (needsKey(provider) && !apiKey) {
      return NextResponse.json({ error: `API key required for ${provider}` }, { status: 400 });
    }

    const prompt = buildPrompt({ goal, notes, existing, count });
    const raw = await runProvider({ provider, prompt, model, apiKey });

    const arr = extractArray(raw);
    if (!arr) {
      return NextResponse.json({ error: 'Could not parse subtasks from model', raw }, { status: 502 });
    }
    return NextResponse.json({ subtasks: cleanList(arr, 8) });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
