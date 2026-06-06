'use client'
import React, { useState, useEffect } from 'react';
import { PROVIDERS, getProvider } from '../lib/aiProviders';

// Settings drawer for configuring the AI subtask provider.
// Keys are held only in the browser and passed per-request — never stored server-side.
export default function AISettings({ open, onClose, settings, onSave, darkMode, status }) {
  const [provider, setProvider] = useState(settings.provider || 'anthropic');
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [model, setModel] = useState(settings.model || '');
  const [testState, setTestState] = useState(null); // null | 'testing' | 'ok' | 'fail'
  const [testMsg, setTestMsg] = useState('');

  // Re-sync local form when the drawer reopens with new saved settings.
  useEffect(() => {
    if (open) {
      setProvider(settings.provider || 'anthropic');
      setApiKey(settings.apiKey || '');
      setModel(settings.model || '');
      setTestState(null);
      setTestMsg('');
    }
  }, [open, settings]);

  if (!open) return null;

  const current = getProvider(provider);
  const panel = darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800';
  const field = darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900';

  const localUnavailable =
    (provider === 'codex' && status && !status.codex) ||
    (provider === 'ollama' && status && !status.ollama);

  async function testConnection() {
    setTestState('testing');
    setTestMsg('');
    try {
      const res = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey,
          model: model || undefined,
          goal: 'Connection test: plan a short walk',
          count: 2,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.subtasks)) {
        setTestState('ok');
        setTestMsg(`Got ${data.subtasks.length} subtasks back ✓`);
      } else {
        setTestState('fail');
        setTestMsg(data.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setTestState('fail');
      setTestMsg(String(e.message || e));
    }
  }

  function save() {
    onSave({ provider, apiKey, model });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full max-w-md h-full overflow-y-auto p-5 shadow-2xl ${panel}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">✨ AI Settings</h2>
          <button onClick={onClose} className="p-1 text-2xl leading-none opacity-60 hover:opacity-100">×</button>
        </div>

        <p className="text-sm opacity-70 mb-4">
          Pick a provider to unlock AI subtask breakdown. Everything else works without this.
        </p>

        {/* Provider cards */}
        <label className="block text-sm font-medium mb-2">Provider</label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PROVIDERS.map((p) => {
            const selected = p.id === provider;
            const avail =
              !p.local ||
              (p.id === 'codex' ? status?.codex : p.id === 'ollama' ? status?.ollama : true);
            return (
              <button
                key={p.id}
                onClick={() => { setProvider(p.id); setModel(''); setTestState(null); }}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition
                  ${selected ? 'border-indigo-500 ring-2 ring-indigo-400' : darkMode ? 'border-gray-600' : 'border-gray-300'}
                  ${avail ? '' : 'opacity-50'}`}
                title={p.local && !avail ? 'Not detected on this machine' : p.note}
              >
                <span className="text-lg">{p.emoji}</span>
                <span className="font-medium">{p.name}</span>
                {p.local && (
                  <span className={`text-[10px] ${avail ? 'text-green-500' : 'opacity-60'}`}>
                    {avail ? 'local ✓' : 'local'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs opacity-70 mb-4">{current?.note}</p>

        {/* API key (only key providers) */}
        {current?.needsKey && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestState(null); }}
              placeholder={current.keyHint}
              className={`w-full p-2 rounded border ${field}`}
            />
            {current.keyUrl && (
              <a href={current.keyUrl} target="_blank" rel="noreferrer"
                 className="text-xs text-indigo-400 hover:underline">
                Get a {current.name} key →
              </a>
            )}
          </div>
        )}

        {/* Model */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Model {current?.models.length ? '' : '(auto)'}</label>
          {current?.models.length ? (
            <select
              value={model || current.models[0]}
              onChange={(e) => setModel(e.target.value)}
              className={`w-full p-2 rounded border ${field}`}
            >
              {current.models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="default"
              className={`w-full p-2 rounded border ${field}`}
            />
          )}
        </div>

        {localUnavailable && (
          <div className="mb-3 text-xs p-2 rounded bg-yellow-100 text-yellow-800">
            {current.name} not detected on this machine. It only works on a local copy,
            not a cloud deploy.
          </div>
        )}

        {/* Privacy note */}
        <div className={`text-xs p-3 rounded mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
          🔒 Your key is stored only in this browser and sent straight to the provider you pick.
          No account, no server storage, no database.
        </div>

        {/* Test + Save */}
        <div className="flex items-center gap-2">
          <button
            onClick={testConnection}
            disabled={testState === 'testing'}
            className="px-3 py-2 rounded border border-indigo-500 text-indigo-500 hover:bg-indigo-50 disabled:opacity-50"
          >
            {testState === 'testing' ? 'Testing…' : 'Test'}
          </button>
          <button
            onClick={save}
            className="px-4 py-2 rounded bg-indigo-600 text-white flex-grow hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
        {testState === 'ok' && <p className="mt-2 text-sm text-green-500">{testMsg}</p>}
        {testState === 'fail' && <p className="mt-2 text-sm text-red-500 break-words">✗ {testMsg}</p>}
      </div>
    </div>
  );
}
