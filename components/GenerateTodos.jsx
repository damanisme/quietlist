'use client'
import React, { useState } from 'react';
import { getProvider } from '../lib/aiProviders';

// Modal: generate a whole to-do list from a project — a local folder (private,
// best with a local provider) or a GitHub repo (works anywhere). Reviewable before adding.
export default function GenerateTodos({ open, onClose, aiSettings, configured, darkMode, onAddTasks, onOpenSettings, status }) {
  const [source, setSource] = useState('folder');
  const [pathInput, setPathInput] = useState('');
  const [repoInput, setRepoInput] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null); // [{ text, checked }]

  if (!open) return null;

  const panel = darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800';
  const field = darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900';
  const provider = getProvider(aiSettings.provider);
  const isLocalProvider = provider?.local;

  async function generate() {
    if (!configured) { onOpenSettings(); return; }
    setLoading(true); setError(''); setResults(null);
    try {
      const body = {
        source,
        provider: aiSettings.provider,
        apiKey: aiSettings.apiKey,
        model: aiSettings.model || undefined,
        count: 8,
      };
      if (source === 'folder') body.path = pathInput;
      else { body.repo = repoInput; body.githubToken = token || undefined; }

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.tasks) || data.tasks.length === 0) {
        throw new Error(data.error || 'No tasks generated');
      }
      setResults(data.tasks.map((t) => ({ text: t, checked: true })));
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Name the parent task after the project being scanned
  function parentLabel() {
    if (source === 'github') {
      const r = repoInput.trim().replace(/\.git$/, '').split('/').filter(Boolean).slice(-2).join('/');
      return r ? `🐙 ${r}` : '🐙 GitHub repo';
    }
    const p = pathInput.trim().replace(/[\\/]+$/, '');
    const base = p ? p.split(/[\\/]/).pop() : 'this project';
    return `📂 ${base || 'project'}`;
  }

  function addSelected() {
    const picked = (results || []).filter((r) => r.checked).map((r) => r.text);
    if (picked.length) onAddTasks(picked, parentLabel());
    onClose();
  }

  const Tab = ({ id, label }) => (
    <button
      onClick={() => { setSource(id); setResults(null); setError(''); }}
      className={`px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 ${source === id ? 'border-indigo-500 text-indigo-500' : 'border-transparent opacity-60'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 rounded-xl shadow-2xl ${panel}`}>
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-xl font-bold">✨ Generate a to-do list</h2>
          <button onClick={onClose} className="p-1 text-2xl leading-none opacity-60 hover:opacity-100">×</button>
        </div>
        <p className="text-sm opacity-70 mb-4">
          Let AI read a project and propose the tasks. Using provider:{' '}
          <span className="font-medium">{provider ? `${provider.emoji} ${provider.name}` : 'none — set one up'}</span>.
        </p>

        <div className="flex gap-1 border-b border-gray-300/30 mb-4">
          <Tab id="folder" label="📁 Local folder" />
          <Tab id="github" label="🐙 GitHub repo" />
        </div>

        {source === 'folder' ? (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Folder path</label>
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="/home/you/projects/app · C:\Users\you\app · \\wsl.localhost\… (blank = this app's folder)"
              className={`w-full p-2 rounded border ${field}`}
            />
            <p className="text-xs opacity-60 mt-1">
              Windows (<code>C:\…</code>, <code>\\wsl.localhost\…</code>) or Linux paths both work.
              Reads the local folder on the machine running this app. {isLocalProvider
                ? 'Your local provider keeps it fully private.'
                : '⚠️ A cloud provider receives a digest of the folder — pick Ollama/Codex in AI settings to keep it private.'}
              {' '}Local folder works only when running locally, not on a cloud deploy.
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">GitHub repo</label>
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/repo  or  https://github.com/owner/repo"
              className={`w-full p-2 rounded border ${field}`}
            />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="GitHub token (only for private repos)"
              className={`w-full p-2 rounded border mt-2 ${field}`}
            />
            <p className="text-xs opacity-60 mt-1">Reads the README, docs/notes (.md), file tree, and open issues to understand the project.</p>
          </div>
        )}

        <button
          onClick={generate}
          disabled={loading}
          className="w-full px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? '⏳ Reading the project…' : '✨ Generate tasks'}
        </button>

        {error && <p className="mt-3 text-sm text-red-500 break-words">⚠️ {error}</p>}

        {results && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{results.filter((r) => r.checked).length} of {results.length} selected</span>
              <button
                className="text-xs text-indigo-400 hover:underline"
                onClick={() => {
                  const allOn = results.every((r) => r.checked);
                  setResults(results.map((r) => ({ ...r, checked: !allOn })));
                }}
              >
                toggle all
              </button>
            </div>
            <ul className="space-y-1 mb-4">
              {results.map((r, i) => (
                <li key={i}>
                  <label className={`flex items-start gap-2 p-2 rounded cursor-pointer ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <input
                      type="checkbox"
                      checked={r.checked}
                      onChange={() => setResults(results.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                      className="mt-1"
                    />
                    <span className="text-sm">{r.text}</span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              onClick={addSelected}
              disabled={!results.some((r) => r.checked)}
              className="w-full px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              Add {results.filter((r) => r.checked).length} task{results.filter((r) => r.checked).length === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
