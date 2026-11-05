# Architecture (Stack A)

Vite + React + TypeScript, @dnd-kit/core for drag/drop, idb (IndexedDB), Canvas 2D export.

- `src/types.ts` – Doc = {settings, theme, items}. Single source of truth; images stored separately (id refs).
- `src/model.ts` – geometry, overlap lanes, time formatting, shared item text layout.
- `src/render.ts` – Canvas drawing used by BOTH the editor background and export, so export matches screen.
- `src/db.ts` – IndexedDB persistence, image downscaling, JSON backup.
- `src/history.ts` – undo/redo with coalescing of rapid edits.
- `src/components/` – Tray, Grid, Inspector, ExportDialog.

Decisions: items are DOM overlays (interactive) on a canvas-drawn grid; item text lines come from one shared
layout function so DOM and canvas agree. Export never uses DOM-to-image libraries (font/shadow glitches).
