import { NextResponse } from 'next/server';
import { execFile } from 'child_process';

export const runtime = 'nodejs';

function hasBinary(cmd) {
  return new Promise((resolve) => {
    execFile(cmd, ['--version'], { timeout: 4000 }, (err) => resolve(!err));
  });
}

// Tells the UI which local, no-key providers are usable on this machine.
export async function GET() {
  const codex = await hasBinary('codex');
  let ollama = false;
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(1500),
    });
    ollama = res.ok;
  } catch {}
  return NextResponse.json({ codex, ollama });
}
