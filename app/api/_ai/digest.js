// Build a bounded "project digest" from a local folder or a GitHub repo, so an
// LLM can understand the project and plan logical next steps. The project's WRITTEN
// context (.md / .txt notes, plans, docs) is the primary signal — not just code.
import { readdir, readFile, stat } from 'fs/promises';
import { execFile } from 'child_process';
import path from 'path';

const IGNORE = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.vercel', 'coverage', '.cache', 'out']);
const CONFIG_FILES = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'requirements.txt'];
const DOC_RE = /\.(md|mdx|markdown|txt|rst)$/i;
const SRC_RE = /\.(js|jsx|ts|tsx|py|go|rs|java|rb|php|c|cpp|cs|vue|svelte)$/;

const MAX_TREE = 200;
const MAX_DOC_FILES = 14;     // how many .md/.txt files to read
const MAX_DOC_FILE_CHARS = 4500;
const MAX_DOC_TOTAL = 16000;  // total chars of doc content
const MAX_CONFIG_CHARS = 1500;
const MAX_TODOS = 25;

function gitLog(dir) {
  return new Promise((resolve) => {
    execFile('git', ['-C', dir, 'log', '--oneline', '-15'], { timeout: 5000 }, (err, out) =>
      resolve(err ? '' : (out || '').trim())
    );
  });
}

// Sort docs so the most context-rich come first: README, then shallower paths.
function rankDocs(a, b) {
  const ar = /readme/i.test(a) ? 0 : 1;
  const br = /readme/i.test(b) ? 0 : 1;
  if (ar !== br) return ar - br;
  return a.split('/').length - b.split('/').length;
}

// Accept Windows-style paths and convert to the Linux paths this (WSL) server reads:
//   \\wsl.localhost\Ubuntu\home\rp\x  ->  /home/rp/x
//   C:\Users\rp\app                   ->  /mnt/c/Users/rp/app
function toLinuxPath(p) {
  let s = (p || '').trim().replace(/^["']|["']$/g, '');
  if (!s) return s;
  s = s.replace(/^\\\\wsl(?:\.localhost|\$)\\[^\\]+\\?/i, '/');
  s = s.replace(/^([A-Za-z]):[\\/]/, (_, d) => `/mnt/${d.toLowerCase()}/`);
  s = s.replace(/\\/g, '/');
  return s;
}

// ---- local folder ------------------------------------------------------

export async function folderDigest(inputPath) {
  const cleaned = toLinuxPath(inputPath);
  const dir = path.resolve(cleaned && cleaned.trim() ? cleaned.trim() : process.cwd());
  const st = await stat(dir).catch(() => null);
  if (!st || !st.isDirectory()) throw new Error(`Not a directory: ${dir}`);

  const tree = [];
  const docFiles = []; // { rel, full }
  const sourceFiles = [];
  const todos = [];

  async function walk(d, rel, depth) {
    if (depth > 4 || tree.length >= MAX_TREE) return;
    const entries = await readdir(d, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.env.example') continue;
      if (IGNORE.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        tree.push(`${r}/`);
        await walk(path.join(d, e.name), r, depth + 1);
      } else {
        tree.push(r);
        if (DOC_RE.test(e.name)) docFiles.push({ rel: r, full: path.join(d, e.name) });
        else if (SRC_RE.test(e.name)) sourceFiles.push(path.join(d, e.name));
      }
      if (tree.length >= MAX_TREE) return;
    }
  }
  await walk(dir, '', 0);

  // DOCS & NOTES — read the project's written context (the primary signal)
  docFiles.sort((a, b) => rankDocs(a.rel, b.rel));
  const docParts = [];
  let budget = MAX_DOC_TOTAL;
  for (const f of docFiles.slice(0, MAX_DOC_FILES)) {
    if (budget <= 0) break;
    const content = await readFile(f.full, 'utf8').catch(() => '');
    if (!content.trim()) continue;
    const slice = content.slice(0, Math.min(MAX_DOC_FILE_CHARS, budget));
    docParts.push(`### ${f.rel}\n${slice}`);
    budget -= slice.length;
  }

  // Project type / config (small)
  const configParts = [];
  for (const name of CONFIG_FILES) {
    const c = await readFile(path.join(dir, name), 'utf8').catch(() => null);
    if (c) configParts.push(`### ${name}\n${c.slice(0, MAX_CONFIG_CHARS)}`);
  }

  // Code TODO/FIXME markers (secondary)
  for (const fp of sourceFiles.slice(0, 40)) {
    if (todos.length >= MAX_TODOS) break;
    const content = await readFile(fp, 'utf8').catch(() => '');
    for (const line of content.split('\n')) {
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) {
        todos.push(`${path.relative(dir, fp)}: ${line.trim().slice(0, 120)}`);
        if (todos.length >= MAX_TODOS) break;
      }
    }
  }

  const log = await gitLog(dir);

  return [
    `PROJECT DIRECTORY: ${dir}`,
    ``,
    `FILE TREE (truncated):`,
    tree.slice(0, MAX_TREE).join('\n'),
    docParts.length ? `\nDOCS & NOTES (.md / .txt — the project's written context; read these closely):\n${docParts.join('\n\n')}` : '',
    configParts.length ? `\nPROJECT CONFIG:\n${configParts.join('\n\n')}` : '',
    todos.length ? `\nCODE TODO/FIXME MARKERS:\n${todos.join('\n')}` : '',
    log ? `\nRECENT COMMITS:\n${log}` : '',
  ].filter(Boolean).join('\n');
}

// ---- GitHub repo -------------------------------------------------------

function parseRepo(input) {
  const s = (input || '').trim().replace(/\.git$/, '');
  const m = s.match(/github\.com[/:]([^/]+)\/([^/?#]+)/) || s.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!m) throw new Error('Use a GitHub URL or "owner/repo"');
  return { owner: m[1], repo: m[2] };
}

export async function githubDigest(input, token) {
  const { owner, repo } = parseRepo(input);
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'quietlist' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const api = (p) => fetch(`https://api.github.com/repos/${owner}/${repo}${p}`, { headers });

  const repoRes = await api('');
  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error(`Repo not found (or private): ${owner}/${repo}`);
    throw new Error(`GitHub ${repoRes.status}`);
  }
  const meta = await repoRes.json();

  let readme = '';
  const rdRes = await api('/readme');
  if (rdRes.ok) {
    const rd = await rdRes.json();
    readme = Buffer.from(rd.content || '', 'base64').toString('utf8').slice(0, 6000);
  }

  let tree = [];
  const trRes = await api(`/git/trees/${meta.default_branch}?recursive=1`);
  if (trRes.ok) {
    const tr = await trRes.json();
    tree = (tr.tree || [])
      .filter((n) => !n.path.split('/').some((seg) => IGNORE.has(seg)))
      .map((n) => (n.type === 'tree' ? `${n.path}/` : n.path))
      .slice(0, MAX_TREE);
  }

  // Read up to 4 extra .md docs (besides README) — the written context
  const docPaths = tree
    .filter((p) => /\.(md|mdx|markdown)$/i.test(p) && !/readme/i.test(p))
    .sort(rankDocs)
    .slice(0, 4);
  const docParts = [];
  let budget = MAX_DOC_TOTAL - readme.length;
  for (const dp of docPaths) {
    if (budget <= 0) break;
    const encoded = dp.split('/').map(encodeURIComponent).join('/');
    const cRes = await api(`/contents/${encoded}`);
    if (!cRes.ok) continue;
    const c = await cRes.json();
    const txt = Buffer.from(c.content || '', 'base64').toString('utf8');
    if (!txt.trim()) continue;
    const slice = txt.slice(0, Math.min(MAX_DOC_FILE_CHARS, budget));
    docParts.push(`### ${dp}\n${slice}`);
    budget -= slice.length;
  }

  let issues = [];
  const isRes = await api('/issues?state=open&per_page=20');
  if (isRes.ok) {
    issues = (await isRes.json())
      .filter((i) => !i.pull_request)
      .map((i) => `#${i.number} ${i.title}`)
      .slice(0, 20);
  }

  return [
    `GITHUB REPO: ${owner}/${repo}`,
    meta.description ? `DESCRIPTION: ${meta.description}` : '',
    meta.language ? `PRIMARY LANGUAGE: ${meta.language}` : '',
    ``,
    readme ? `README:\n${readme}` : '',
    docParts.length ? `\nDOCS & NOTES (.md — read these closely):\n${docParts.join('\n\n')}` : '',
    tree.length ? `\nFILE TREE (truncated):\n${tree.join('\n')}` : '',
    issues.length ? `\nOPEN ISSUES:\n${issues.join('\n')}` : '',
  ].filter(Boolean).join('\n');
}
