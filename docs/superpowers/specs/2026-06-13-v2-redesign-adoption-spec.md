# QuietList v2 — Visual Redesign Adoption Spec

**Date:** 2026-06-13
**Status:** Draft for review
**Goal:** Bring the v2 mockup's modern, marketable look into the real app **with minimal
code churn** — keep all existing behavior, change the skin, not the engine.

Mockup reference: `docs/mockup/index.html` (served at `localhost:4000`).
Live app reference: `components/TaskMasterApp.jsx` (served at `localhost:3000`).

---

## 1. Feature inventory — what the app already has

The mockup is a *re-skin*, not a new product. Every feature below already exists in the
real app and **must survive** the redesign unchanged.

| # | Feature | Where it lives today |
|---|---------|----------------------|
| 1 | Tasks: add / edit / delete / complete | `TaskMasterApp.jsx` (tasks state, line ~83) |
| 2 | Subtasks: add / edit / delete / complete, progress count | `expandedTasks`, `activeSubtaskParent` |
| 3 | Priority levels (high / medium / low) | `priority` state + `getPriorityClasses()` ~1074 |
| 4 | Search across tasks + subtasks | `searchTerm` state |
| 5 | Markdown notes per task | `editingNotesTaskId`, `editingNotes` |
| 6 | Drag-and-drop reorder (mouse + touch) | `draggedTaskId` … `isTouch` block |
| 7 | Pomodoro timer (pomodoro / short / long / custom), bind to a task | `timeLeft`, `timerMode`, `activeTask` ~111 |
| 8 | Dark mode | `darkMode` boolean state |
| 9 | Persistence — everything in `localStorage` | load/save effects |
| 10 | AI subtask breakdown (per-task ✨ + header ✨) | calls `/api/ai/breakdown` |
| 11 | AI "generate to-do list from a project" (folder / GitHub) | `GenerateTodos.jsx` → `/api/ai/generate` |
| 12 | AI settings drawer (BYOK + local providers) | `AISettings.jsx`, `aiSettings` |
| 13 | Multi-provider catalog | `lib/aiProviders.js` |

**Rule:** the redesign touches presentation only. No feature in this table changes
behavior, storage shape, or API contract.

---

## 2. Current implementation reality (the constraint)

What the styling actually looks like under the hood — this is what makes some redesign
moves cheap and others expensive.

- **One big component.** `TaskMasterApp.jsx` is ~1,900 lines; all markup + styling inline.
- **Scattered color literals.** Styling is hardcoded Tailwind classes with no shared
  palette: `bg-indigo-600`, `bg-blue-600`, `bg-red-50`, `bg-gray-200`, `bg-gray-50`…
  scattered across the file. No single source of truth for color.
- **Dark mode is inconsistent.** Only **7** `darkMode ? … : …` ternaries exist. Many
  controls are hardcoded (`bg-gray-200`, `bg-gray-300`) and **do not adapt** to dark mode
  at all — a real bug the redesign can fix for free.
- **No design tokens.** `tailwind.config.js` `theme.extend` is empty `{}`.
- **No custom font.** `app/layout.js` sets no font; the UI uses the system default.
- **Layout.** Single centered column: `max-w-2xl mx-auto p-4`.
- **globals.css** is tiny (3 keyframes). Plenty of room to add a token layer.

**Implication:** because color is scattered and dark mode is already half-broken, the
highest-leverage minimal move is to introduce a **token layer** (CSS variables) and point
styles at it — not to hand-edit 1,900 lines.

---

## 3. The v2 design language (from the mockup)

The look that makes it marketable, distilled into adoptable pieces:

| Token group | Value |
|---|---|
| **Palette (light)** | warm paper `#f3ede1`, card `#fbf7ee`, ink `#211d18`, ember accent `#c2502f`, sage `#5f7a59`, gold `#b8862f` |
| **Palette (dark)** | espresso `#17140f`, card `#211c15`, cream ink `#f0e9da`, ember `#e3744f` |
| **Display font** | Fraunces (serif, italic "Quiet" wordmark) |
| **UI/body font** | Hanken Grotesk |
| **Mono font** | Geist Mono (timer, counts, paths) |
| **Surface** | soft cards, 1px warm edges, layered shadows, 16px radius |
| **Atmosphere** | faint grain texture + corner glow gradients |
| **Motion** | staggered load-in, hover lift on cards, blinking timer colon |
| **Layout** | app-shell: left rail (brand + stats + filters + generate) · main column |
| **Components restyled** | priority chips, subtask progress, AI-tagged parent groups, pill buttons |

---

## 4. Gap map + minimal adoption plan

Ranked by **impact ÷ effort**. The first three phases are the "minimal" core; they deliver
~80% of the visual upgrade without restructuring the component. Phases 4–5 are optional.

### Phase 1 — Token layer + fonts  ·  *highest leverage, lowest risk*
**Effort: ~1–2 files.** No component restructure.
- Add CSS variables to `app/globals.css` for both themes (`:root` + `[data-theme="dark"]`),
  copied from the mockup's token block.
- Load Fraunces / Hanken Grotesk / Geist Mono in `app/layout.js` (Next `next/font/google`),
  set Hanken as the body default, expose the others via CSS vars.
- Switch dark mode from a JS-driven class to `document.documentElement.dataset.theme`
  (keep the existing `darkMode` state; just have it set the attribute). One small effect.

*Result on its own:* warm palette + real fonts + atmosphere — already reads as "v2",
even before touching individual controls.

### Phase 2 — Retire scattered color literals  ·  *fixes dark mode for free*
**Effort: find/replace within the one component.**
- Replace hardcoded brand colors (`bg-indigo-600`, `bg-blue-600`) with token-backed classes
  (e.g. an `.btn-primary` / `.btn-ink` utility in globals.css reading the vars).
- Replace the `bg-gray-*` controls (the ones that ignore dark mode) with token surfaces
  (`var(--card)`, `var(--paper-2)`). This **fixes the inconsistent dark mode** as a
  side effect.
- Map priority classes (`getPriorityClasses()`) to the mockup's chip styles.

*Keep it minimal:* introduce ~5 small utility classes in `globals.css` and point existing
markup at them, rather than rewriting every `className`.

### Phase 3 — Card + control polish  ·  *the tactile upgrade*
**Effort: localized class tweaks.**
- Task rows → cards: warm edge, 16px radius, hover lift (reuse mockup's `.task` styles).
- Pill-shaped buttons, mono timer numerals, checkbox styling, subtask indent + divider.
- Staggered load animation via `animation-delay` on the task map.

### Phase 4 — App-shell layout  ·  *optional, bigger change*
**Effort: wrap the render in a 2-column grid.**
- Move brand + stats + filters + "Generate from a project" into a left rail; tasks +
  Pomodoro + add-bar into the main column.
- This is the only phase that **moves markup around**, so it carries the most risk. Ship
  Phases 1–3 first; treat the shell as a follow-up once the skin is proven.

### Phase 5 — Wordmark + hero copy  ·  *nice-to-have*
- Fraunces wordmark with italic ember "Quiet"; one-line hero in the rail.

---

## 5. What stays out of scope (keep it minimal)

- **No** refactor of the 1,900-line component into smaller files (tempting, not required).
- **No** state-management or storage changes.
- **No** new dependencies beyond `next/font` (already in Next).
- **No** behavior changes to AI routes, drag-drop, or persistence.

---

## 6. Recommended first slice

Ship **Phase 1 only** as the first PR and eyeball it against the mockup. It's two files
(`globals.css`, `layout.js`) plus a one-line theme-attribute effect, fully reversible, and
proves the palette/fonts in the real app before committing to control-level edits.

**Verify:** `localhost:3000` renders with warm paper + Fraunces wordmark, dark toggle flips
the `data-theme` attribute, and every feature in §1 still works.
