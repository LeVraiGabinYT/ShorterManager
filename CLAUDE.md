# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ShorterManager is a cross-platform desktop app (Electron + React + TypeScript — runs identically on
macOS, Windows, and Linux; not a native-macOS-only app) for managing the content pipeline of a
YouTube channel: video ideas, purchased gear/objects, and the channel itself via YouTube Data API /
Google OAuth (connected once, tokens refreshed silently afterward).

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

`tags` (name + color) attach to both `ideas` (via `idea_tags`) and fetched YouTube videos (via
`published_video_tags`) — the same tag vocabulary connects ideas to real channel performance. See
"Tags bridge" below for how a linked video's tags actually resolve.

- `channel_connection` — OAuth tokens for the connected Google/YouTube channel (singleton row,
  `id = 1`). Never expose its contents to the renderer directly — only a derived `ChannelStatus`
  (connected/channelId/channelTitle), produced by `getChannelStatus()` in `src/main/db/channel.ts`.
- `published_videos` — YouTube videos fetched from the channel, optionally linked back to the
  `idea` they came from via `idea_id` (nullable FK), with cached view/like/comment counts,
  `average_view_percentage`, and `description` (used for keyword search, never shown in the UI).
  Upserted by `youtube_video_id`, never duplicated.
- `analysis_groups` / `analysis_group_videos` — named, manually-curated sets of `published_videos`
  for the Analyse tab's group comparison. A group has no filter/query attached to it — it's a fixed
  list of video IDs, built once (typically from an Explorer selection) and edited by hand after.

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

`src/renderer/src/components/` holds cross-feature UI with no domain data of its own — currently
just `SearchablePicker.tsx`, a generic type-to-filter combobox (used for linking an idea to a video
and vice versa) that only filters whatever `items` array it's given; it has no idea of "ideas" or
"videos" and does no network calls itself.

Idea filtering (`IdeasTab`) is entirely client-side and stateless server-side: `IdeaFilters.tsx`
owns the filter UI, `src/renderer/src/lib/ideaFilters.ts`'s `filterIdeas()` is the pure function
applied to the already-fetched ideas array. If a new filter dimension is added, extend
`IdeaFiltersState`/`DEFAULT_IDEA_FILTERS` and `filterIdeas()` together — there's no IPC-side
filtering to keep in sync.

### YouTube integration

Key constraint that drove the design: OAuth must happen only once — the refresh token is stored in
`channel_connection` and silently refreshed via `getValidAccessToken()` in `src/main/youtube/oauth.ts`
(checked/refreshed before every API call), never requiring interactive login again, as long as the
Google Cloud OAuth consent screen is in "Production" status (not "Testing", which caps refresh
tokens at 7 days). The loopback-redirect flow (temporary local HTTP server + `shell.openExternal`,
not a `BrowserWindow`) is the only viable interactive-login mechanism for an Electron desktop app —
Google blocks OAuth consent inside embedded webviews. **The OAuth client in Google Cloud Console
must be of type "Desktop app"**, not "Web application" — confirmed the hard way: a Web application
client requires pre-registering an exact redirect URI including port, while a Desktop app client
accepts any `127.0.0.1:<port>` loopback redirect, which is what the random-port server needs.
Credentials live in a local, gitignored `credentials/google-oauth.json` (Google's own downloadable
format; `src/main/youtube/credentials.ts` also falls back to `<userData>/google-oauth.json` for a
packaged build), read only by the main process — the renderer only ever sees a `ChannelStatus` or
`PublishedVideo[]`, never tokens.

Two separate Google APIs are involved, both called from `src/main/youtube/videos.ts`: YouTube Data
API v3 (uploads playlist → video list → stats) and YouTube Analytics API
(`averageViewPercentage`/retention specifically — not available from the Data API). The Analytics
call is wrapped to fail silently (retention just stays `null`) so a hiccup there never breaks the
rest of a video refresh.

`channel:listVideos` (reads the local `published_videos` cache) and `channel:refreshVideos` (hits
the YouTube APIs, upserts, then returns the cache) are deliberately separate IPC calls — the former
is cheap and called from `useIdeasData()` on every relevant screen's mount, the latter is
network/quota-costly and only triggered by the Channel tab's explicit "Actualiser" button. Never
make `listVideos` call out to the network.

`refreshRecentVideos()` only ever caches the most recent `MAX_RECENT_VIDEOS` (25) uploads — for a
channel that posts often, older videos are never fetched this way. `searchChannelVideos()` (IPC
`channel:searchVideos`) exists specifically for that gap: it hits `search.list?forMine=true` (a
different, costlier Data API endpoint that searches the _whole_ channel by keyword, not just the
cache), then funnels matches through the same `upsertVideoMetas()` helper as the recent-videos
refresh so they're immediately cached and usable everywhere. The Channel tab's search bar is the
only UI for this; the searchable pickers elsewhere (see below) only ever search what's already
cached.

**Tags bridge**: once a `published_video` is linked to an idea (`idea_id` set), its `tagIds` in
`PublishedVideo` ARE the linked idea's tags — read live from `idea_tags`, not stored redundantly.
Editing them only happens through the idea (`IdeaFormModal`'s `TagPicker`), not the video. An
unlinked video keeps independently-assigned tags in `published_video_tags`, editable directly from
`ChannelVideoDetailModal`. This split (see `toPublishedVideo()` in
`src/main/db/publishedVideos.ts`) lets the Analyse tab tag historical videos that have no
corresponding local idea, while linked videos never drift out of sync with their idea.
`linkVideoToIdea()` (`src/main/youtube/videos.ts`) merges a video's pre-link direct tags into the
target idea's tags before switching over — link always preserves tags, never silently drops them.

### Analyse tab

Three sub-views under `src/renderer/src/features/analysis/AnalysisTab.tsx`
(Explorer/Groups/Timeline), all pure client-side computation over `useIdeasData()`'s already-fetched
`publishedVideos`/`ideas`/`tags`/`objects` — the only new backend surface is `analysis_groups`
(`src/main/db/analysisGroups.ts`). `computeVideoStats()`
(`src/renderer/src/lib/videoStats.ts`) is the one place that averages view/like/comment/retention
counts; it always filters out any video with a `null viewCount` first — every consumer (Explorer's
live filter results, a group, a group comparison) must go through it rather than averaging raw
arrays inline, or a fetch-failed video will corrupt the numbers. `filterPublishedVideos()`
(`src/renderer/src/lib/analysisFilters.ts`) is the Explorer-side counterpart to `filterIdeas()` —
same tag any/all + object + keyword shape, but over `PublishedVideo[]`; `getVideoObjectIds()` in
the same file is the only way a video's objects are known (through its linked idea, if any).

`AddToGroupControl.tsx` is shared between `ExplorerPanel` and `ChannelTab` (bulk-select in the
Channel tab's video list can add straight to a group without going through Explorer) —
`useAnalysisGroups()` is the matching shared fetch hook, mirroring `useIdeasData()`'s pattern.

Bulk selection exists in two places with the same shape (a checkbox per row, a "tout sélectionner"
for whatever's currently displayed) but different actions: `IdeasTab` pairs it with
`BulkActionsBar.tsx` (add a tag/object or set a status across the selection — each call rebuilds a
full `VideoIdeaInput` via `toIdeaInput()`, since `ideas:update` has no partial-patch mode);
`ChannelTab` pairs it with `AddToGroupControl`. `IdeaCard`'s wrapper is a `<div onClick>` rather
than a `<button>` specifically so its selection checkbox can `stopPropagation()` without fighting
the card's own click-to-edit behavior.

`ChannelTab.handleAddToList()` checks for an existing idea whose trimmed title exactly matches the
video's before creating a new one; a match opens `DuplicateIdeaModal.tsx` (link to the existing idea
instead of duplicating, or force-create anyway). The actual tag-merge on confirm is not
special-cased here — it's the same general merge `linkVideoToIdea()` always does (see "Tags
bridge" above).

**Linking** (`src/main/youtube/videos.ts`): `createIdeaFromVideo()` makes a new idea from a real
video (title/status `published`/publishDate copied over) and links it; `linkVideoToIdea()` links an
_existing_ idea instead. Both paths call `markIdeaPublished()` (`src/main/db/ideas.ts`), which
forces the idea's `status` to `published` and syncs `publishDate` to the video's real date — this
is a deliberate one-way sync (video truth → idea fields), not a two-way binding.

`NOT_POSTED_STAT = -1` (`src/shared/types.ts`) is the agreed sentinel for an idea's view/like/comment
count when it has no linked video. **Any future aggregation (the Analyse tab) must filter these out
before averaging** — never treat a `-1` or an idea with no linked video as a real 0.
