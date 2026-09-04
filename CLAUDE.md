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
  `contextBridge`. This is the _only_ place `ipcRenderer` is used from the renderer side.
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

`tags` (name + color) attach to both `ideas` (via `idea_tags`) and, once built, fetched YouTube
videos (via `published_video_tags`) — the same tag vocabulary is meant to connect ideas to real
channel performance later.

Tables that exist but have no application code yet — reserved for the YouTube integration
currently being built (see `PROGRESS.md` for the exact plan and where it stands):

- `channel_connection` — OAuth tokens for the connected Google/YouTube channel (singleton row,
  `id = 1`). Never expose its contents to the renderer directly — only a derived `ChannelStatus`
  (connected/channelId/channelTitle).
- `published_videos` / `published_video_tags` — YouTube videos (optionally linked back to the
  `idea` they came from) with cached stats, for performance comparison by tag.

### IPC

Every DB operation is exposed as an `ipcMain.handle` in `src/main/ipc.ts`
(`registerIpcHandlers()`, called once in `src/main/index.ts`), invoked from the renderer through
`window.api.<domain>.<method>(...)` as defined by `ShorterManagerApi`. There's no event-based
(`ipcMain.on`/`send`) traffic — everything is request/response via `invoke`/`handle`.

### Renderer structure

Feature-folder layout under `src/renderer/src/features/<domain>/`, one tab per domain
(`overview`, `ideas`, `objects`, `channel`) rendered by `App.tsx`'s tab switcher (local `useState`,
no router). Each CRUD feature follows the same shape: a `<Domain>Tab.tsx` that owns the list state
and calls `window.api` directly (no shared client/store layer — components call IPC and re-fetch
after mutations), plus a `<Domain>FormModal.tsx` used for both create and edit.
`src/renderer/src/hooks/useIdeasData.ts` centralizes the ideas+objects fetch/refresh logic shared
by `IdeasTab` and `OverviewTab` (each still keeps its own copy of the fetched state — this dedupes
code, not state, since tabs unmount when switched).

An idea's stored `status` is not always what should be displayed or counted: `getEffectiveStatus()`
in `src/renderer/src/lib/ideaStatus.ts` forces the _effective_ status to `preparation` (plus a
`missingObjects` flag) whenever any linked object has `purchased: false`, overriding the manual
status unless it's already `published`. Anything that shows or counts an idea's status —
`IdeaCard`, `OverviewTab`'s stat cards — must go through this function rather than reading
`idea.status` directly, or it'll disagree with what the rest of the UI shows.

Styling is Tailwind CSS v4 via the `@tailwindcss/vite` plugin (CSS-first config — there is no
`tailwind.config.js`; the only setup is `@import 'tailwindcss'` in
`src/renderer/src/assets/main.css`). The UI is dark-only (no light theme / no theme toggle).

Tags have no dedicated management screen — they're created inline wherever they're picked, via
`TagPicker` (`src/renderer/src/features/tags/TagPicker.tsx`), which both toggles selection and
offers a "+ Nouveau tag" mini-form (name + a swatch from `TAG_COLOR_PRESETS`). Any screen that
lets a user create a tag through this component must pass an `onTagsChanged` callback that
re-fetches the tag list (there's no shared tags store either).

Idea filtering (`IdeasTab`) is entirely client-side and stateless server-side: `IdeaFilters.tsx`
owns the filter UI, `src/renderer/src/lib/ideaFilters.ts`'s `filterIdeas()` is the pure function
applied to the already-fetched ideas array. If a new filter dimension is added, extend
`IdeaFiltersState`/`DEFAULT_IDEA_FILTERS` and `filterIdeas()` together — there's no IPC-side
filtering to keep in sync.

### YouTube integration (in progress)

Being built per the plan in `PROGRESS.md`. Key constraint driving the design: OAuth must happen
only once — the refresh token is stored in `channel_connection` and silently refreshed, never
requiring interactive login again (as long as the Google Cloud OAuth consent screen is in
"Production" status, not "Testing"). The loopback-redirect flow (temporary local HTTP server +
`shell.openExternal`, not a `BrowserWindow`) is the only viable interactive-login mechanism for an
Electron desktop app — Google blocks OAuth consent inside embedded webviews. OAuth client
credentials live in a local, gitignored `credentials/google-oauth.json` (Google's own downloadable
format), read only by the main process; the renderer only ever sees a `ChannelStatus`, never
tokens. Two separate Google APIs are involved: YouTube Data API v3 (videos, stats, comments) and
YouTube Analytics API (`averageViewPercentage`/retention specifically — not available from the
Data API).
