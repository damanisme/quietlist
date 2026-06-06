# Task Master — AI Subtask Breakdown (design)

Date: 2026-06-06

## Goal
Add an opt-in "✨ AI breakdown" feature that turns a task/goal into 3–6 concrete
subtasks. This is the differentiator meant to make the repo star-worthy, on top of
a polished README + deploy story. Everything non-AI must keep working with zero key,
zero account, fully offline (the existing "privacy-first" todo).

## Principles
- AI is **opt-in**. No key = normal offline todo, unchanged.
- Keys live **only in the browser** (localStorage), passed per-request, never stored
  server-side. The app keeps no database.
- Multi-provider by design (a selling point): Claude, GPT, Gemini, Groq (BYOK) plus
  two **local, no-key** options: Ollama and the local Codex CLI.

## Architecture
Single stateless Next.js API route acts as a proxy (avoids browser CORS and keeps
provider request shapes server-side). It stores nothing.

- `POST /api/ai/breakdown` — body `{ provider, goal, model?, apiKey?, count? }` →
  `{ subtasks: string[] }`. Dispatches per provider:
  - `anthropic` → `api.anthropic.com/v1/messages`
  - `openai` → `api.openai.com/v1/chat/completions`
  - `groq` → `api.groq.com/openai/v1/chat/completions`
  - `gemini` → `generativelanguage.googleapis.com/.../generateContent`
  - `ollama` (local) → `http://localhost:11434/api/chat`
  - `codex` (local) → shells `codex exec --skip-git-repo-check -o <tmp>` (uses the
    machine's existing Codex auth; no key). Local-only — absent on a cloud deploy.
- `GET /api/ai/status` → `{ codex, ollama }` so the UI can surface local options.

The model is prompted to return ONLY a JSON array of short strings; the route
extracts the first `[...]` and validates.

## Components
- `components/AISettings.jsx` — drawer: provider cards, masked key input with a Test
  button, model select, privacy note. Matches existing Tailwind/dark-mode style.
- `components/TaskMasterApp.jsx` edits:
  - state: `aiSettings {provider, apiKey, model}`, `aiSettingsOpen`, `aiStatus`,
    `aiLoadingId`, `aiMessage`; load/save settings to `taskMasterAISettings`.
  - `aiBreakdown(goal, taskId)` → calls route, appends returned subtasks, auto-expands.
  - header gets a ⚙️ button; each task gets a ✨ button; Add-Task form gets
    "✨ Add + AI Subtasks".
  - not configured → open settings instead of calling.

## Error handling
- Missing key for a key provider → 400, UI nudges to Settings.
- Provider/network error → toast with message; task unchanged.
- Unparseable model output → 502 with raw text for debugging.

## Out of scope (v1)
Streaming, accounts/sync, server-side key storage, rate limiting on a public demo.

## Deploy story
README with screenshot, feature list, BYOK explanation, "Deploy to Vercel" button,
MIT license. Actual push/deploy needs the user's GitHub/Vercel auth (follow-up).
