# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ShorterManager is a cross-platform desktop app (Electron + React + TypeScript — runs identically on
macOS, Windows, and Linux; not a native-macOS-only app) for managing the content pipeline of a
YouTube channel: video ideas, purchased gear/objects, and (eventually) the channel itself via
YouTube Data API / Google OAuth.

For current feature status and what to build next, see `PROGRESS.md` — read it at the start of
any session on this repo before planning work.

## Commands

```bash
npm install          # install deps (runs electron-builder install-app-deps via postinstall,
                      # which rebuilds native modules like better-sqlite3 for Electron's ABI)
npm run dev           # start app in dev mode (electron-vite dev, HMR renderer + main/preload watch)
npm run typecheck     # tsc --noEmit for both main/preload (tsconfig.node.json) and renderer (tsconfig.web.json)
npm run lint          # eslint --cache .
npm run format        # prettier --write .
npm run build         # typecheck + electron-vite build (production bundles in out/)
npm run build:mac     # build + package a macOS app via electron-builder
```

There is no test suite yet.

If npm ever reports "packages have install scripts not yet covered by allowScripts" (npm's
install-script security gate), run `npm install-scripts approve <pkg>` for legitimate new native
deps, then `npm install` again — otherwise native modules won't get rebuilt for Electron.

## Architecture

### Process model

Standard Electron three-process split, built with `electron-vite` (config: `electron.vite.config.ts`):

- `src/main/` — Node process. Owns the SQLite database and all business logic. Never rendered.
- `src/preload/` — runs in the renderer's context with Node access, bridges main ↔ renderer via
  `contextBridge`. This is the *only* place `ipcRenderer` is used from the renderer side.
- `src/renderer/src/` — the React UI. Has no direct access to Node/Electron APIs except through
  `window.api` (typed) and `window.electron` (from `@electron-toolkit/preload`).
- `src/shared/types.ts` — the single source of truth for domain types (`VideoIdea`, `OwnedObject`,
  etc.) and the `ShorterManagerApi` interface. Main, preload, and renderer all import from here, so
  changing the IPC contract means updating this file first, then `src/preload/index.ts` (bridge
  implementation) and `src/main/ipc.ts` (handler registration) to match — TypeScript will flag
  mismatches in preload and renderer.

Path aliases (defined in both `electron.vite.config.ts` and the relevant `tsconfig.*.json`):
`@renderer/*` → `src/renderer/src/*` (renderer only), `@shared/*` → `src/shared/*` (all three
processes).

### Data layer

SQLite via `better-sqlite3`, main-process only. `src/main/db/index.ts` opens the DB file (in
`app.getPath('userData')`) and runs `migrate()` on startup — a single idempotent
`CREATE TABLE IF NOT EXISTS` block, not a versioned migration system. There is no ORM: each domain
gets a file in `src/main/db/` (`ideas.ts`, `objects.ts`) exporting plain functions
(`listIdeas`, `createIdea`, ...) that take/return the shared domain types and do the
row ↔ camelCase mapping internally (SQL columns are snake_case).

`ideas` and `objects` are linked many-to-many through `idea_objects` (an idea's `objectIds` are
read/written as a set on every idea read/write, not incrementally).

Two tables exist but have no application code yet — they're schema reserved for the planned
YouTube integration (see `PROGRESS.md`):
- `channel_connection` — OAuth tokens for the connected Google/YouTube channel.
- `published_videos` — YouTube videos linked back to the `idea` they came from, for performance
  comparison.

### IPC

Every DB operation is exposed as an `ipcMain.handle` in `src/main/ipc.ts`
(`registerIpcHandlers()`, called once in `src/main/index.ts`), invoked from the renderer through
`window.api.<domain>.<method>(...)` as defined by `ShorterManagerApi`. There's no event-based
(`ipcMain.on`/`send`) traffic — everything is request/response via `invoke`/`handle`.

### Renderer structure

Feature-folder layout under `src/renderer/src/features/<domain>/`, one tab per domain
(`ideas`, `objects`, `channel`) rendered by `App.tsx`'s tab switcher (local `useState`, no router).
Each CRUD feature follows the same shape: a `<Domain>Tab.tsx` that owns the list state and calls
`window.api` directly (no shared client/store layer — components call IPC and re-fetch after
mutations), plus a `<Domain>FormModal.tsx` used for both create and edit.

Styling is Tailwind CSS v4 via the `@tailwindcss/vite` plugin (CSS-first config — there is no
`tailwind.config.js`; the only setup is `@import 'tailwindcss'` in
`src/renderer/src/assets/main.css`). The UI is dark-only (no light theme / no theme toggle).
