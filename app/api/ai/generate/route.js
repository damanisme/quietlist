import { NextResponse } from 'next/server';
import { runProvider, extractArray, cleanList, needsKey } from '../../_ai/clients';
import { folderDigest, githubDigest } from '../../_ai/digest';

export const runtime = 'nodejs';
export const maxDuration = 60;

const buildPrompt = (digest, count) =>
  [
    `You are a senior engineer planning the next work on a project.`,
    `Work ONLY from the PROJECT DIGEST below — do NOT run any commands, do NOT read or`,
    `open files, do NOT explore the filesystem. Plan from the given text alone and answer`,
    `immediately.`,
    ``,
    `Produce a prioritized to-do list of about ${count} concrete, actionable tasks — the`,
    `things that should happen next (features to build, bugs to fix, missing tests, docs,`,
    `cleanup). Use the README, file tree, TODO markers, commits, and open issues for context.`,
    ``,
    `Rules:`,
    `- Each task starts with a verb and is specific to THIS project (no generic filler).`,
    `- Order by priority, most important first.`,
    `- Keep each task under ~12 words.`,
    `- No duplicates.`,
    ``,
    `Return ONLY a JSON array of strings. No prose, no numbering, no markdown fences.`,
    ``,
    `--- PROJECT DIGEST ---`,
    digest.slice(0, 14000),
  ].join('\n');

export async function POST(req) {
  try {
    const { source, path: dirPath, repo, githubToken, provider, model, apiKey, count = 8 } = await req.json();

    if (needsKey(provider) && !apiKey) {
      return NextResponse.json({ error: `API key required for ${provider}` }, { status: 400 });
    }

    let digest;
    if (source === 'folder') {
      digest = await folderDigest(dirPath);
    } else if (source === 'github') {
      if (!repo || !repo.trim()) {
        return NextResponse.json({ error: 'Missing repo' }, { status: 400 });
      }
      digest = await githubDigest(repo, githubToken);
    } else {
      return NextResponse.json({ error: 'Unknown source (use folder or github)' }, { status: 400 });
    }

    const prompt = buildPrompt(digest, count);
    const raw = await runProvider({ provider, prompt, model, apiKey });

    const arr = extractArray(raw);
    if (!arr) {
      return NextResponse.json({ error: 'Could not parse tasks from model', raw }, { status: 502 });
    }
    return NextResponse.json({ tasks: cleanList(arr, 15) });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
