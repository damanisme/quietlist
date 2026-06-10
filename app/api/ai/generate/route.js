import { NextResponse } from 'next/server';
import { runProvider, extractArray, cleanList, needsKey } from '../../_ai/clients';
import { folderDigest, githubDigest } from '../../_ai/digest';

export const runtime = 'nodejs';
export const maxDuration = 60;

const buildPrompt = (digest, count) =>
  [
    `You are a thoughtful collaborator helping move a project forward.`,
    `Work ONLY from the PROJECT DIGEST below — do NOT run commands, read files, or explore`,
    `the filesystem. Reason from the given text alone and answer immediately.`,
    ``,
    `First UNDERSTAND the project: read the DOCS & NOTES (.md / .txt) closely along with the`,
    `README, file tree, recent commits, and any open issues. Grasp its goals, current state,`,
    `and where it is heading — the writing in the docs is the most important signal.`,
    ``,
    `Then produce a prioritized to-do list of about ${count} LOGICAL NEXT STEPS that genuinely`,
    `follow from where the project is: the actions the notes and plans imply, unfinished`,
    `threads, decisions to make, things to write or research, and gaps to fill. This is about`,
    `the project's direction — NOT just code fixes. Include non-code work (planning, writing,`,
    `outreach, decisions) wherever the docs call for it.`,
    ``,
    `Rules:`,
    `- Ground every item in what the docs/notes actually say — specific to THIS project.`,
    `- Each item starts with a verb. No generic filler, no duplicates.`,
    `- Order by impact, most important first.`,
    `- Keep each item under ~14 words.`,
    ``,
    `Return ONLY a JSON array of strings. No prose, no numbering, no markdown fences.`,
    ``,
    `--- PROJECT DIGEST ---`,
    digest.slice(0, 18000),
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
