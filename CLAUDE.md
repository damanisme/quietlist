# Claude Code Context

This project was consolidated under `/home/rp/workspaces` from prior OpenClaw workspace paths. Treat this folder as the canonical project root for future development.

## Operating rules
- Prefer files inside this project folder over legacy `/home/rp/.openclaw/workspace/...` paths.
- Legacy paths may still exist as symlinks for compatibility.
- Before changing code, read this file plus `README.md` and any project maps/docs in this folder.
- Do not expose or commit secrets from `secrets/`, `.env`, `.env.local`, or archived credential files.
- If running Claude Code, start from this project folder so this context loads automatically.
- If related context lives in another project, use Claude Code `/add-dir` or `--add-dir` with the paths listed below.

## Project shape
Task Master current working copy migrated from OpenClaw. Inspect `package.json` and compare against `../task-master-app-public` / `../task-master-presell` before major edits.
