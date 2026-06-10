// Build a bounded "project digest" from a local folder or a GitHub repo, so an
// LLM can plan work without us shipping the whole tree (keeps tokens bounded and,
// for local providers, keeps everything private).
import { readdir, readFile, stat } from 'fs/promises';
import { execFile } from 'child_process';
import path from 'path';

const IGNORE = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.vercel', 'coverage', '.cache', 'out']);
const KEY_FILES = ['README.md', 'README', 'readme.md', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'requirements.txt'];
const MAX_TREE = 200;
const MAX_KEYFILE_CHARS = 3000;
const MAX_TODOS = 30;

function gitLog(dir) {
  return new Promise((resolve) => {
    execFile('git', ['-C', dir, 'log', '--oneline', '-15'], { timeout: 5000 }, (err, out) =>
      resolve(err ? '' : (out || '').trim())
    );
  });
}

// ---- local folder ------------------------------------------------------

export async function folderDigest(inputPath) {
  const dir = path.resolve(inputPath && inputPath.trim() ? inputPath.trim() : process.cwd());
  const st = await stat(dir).catch(() => null);
  if (!st || !st.isDirectory()) throw new Error(`Not a directory: ${dir}`);

  const tree = [];
  const todos = [];
  const sourceFiles = [];

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
        if (/\.(js|jsx|ts|tsx|py|go|rs|java|rb|php|c|cpp|cs|vue|svelte)$/.test(e.name)) {
          sourceFiles.push(path.join(d, e.name));
        }
      }
      if (tree.length >= MAX_TREE) return;
    }
  }
  await walk(dir, '', 0);

  // Read key project files
  const keyParts = [];
  for (const name of KEY_FILES) {
    const p = path.join(dir, name);
    const content = await readFile(p, 'utf8').catch(() => null);
    if (content) keyParts.push(`### ${name}\n${content.slice(0, MAX_KEYFILE_CHARS)}`);
  }

  // Scan a sample of source files for TODO/FIXME markers
  for (const f of sourceFiles.slice(0, 60)) {
    if (todos.length >= MAX_TODOS) break;
    const content = await readFile(f, 'utf8').catch(() => '');
    for (const line of content.split('\n')) {
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) {
        todos.push(`${path.relative(dir, f)}: ${line.trim().slice(0, 120)}`);
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
    ``,
    keyParts.length ? `KEY FILES:\n${keyParts.join('\n\n')}` : '',
    todos.length ? `\nTODO/FIXME MARKERS:\n${todos.join('\n')}` : '',
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
    readme = Buffer.from(rd.content || '', 'base64').toString('utf8').slice(0, 4000);
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
    readme ? `README (truncated):\n${readme}` : '',
    tree.length ? `\nFILE TREE (truncated):\n${tree.join('\n')}` : '',
    issues.length ? `\nOPEN ISSUES:\n${issues.join('\n')}` : '',
  ].filter(Boolean).join('\n');
}
