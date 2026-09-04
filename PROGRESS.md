# PROGRESS.md

Living status file for ShorterManager. Read this first when resuming work on the repo — it's the
"where did we leave off" doc. Update it whenever a milestone lands or the plan changes; don't let
it go stale. See `CLAUDE.md` for architecture/commands.

## Vision

A cross-platform desktop app (macOS/Windows/Linux) for managing a YouTube channel's content
pipeline end-to-end:

- **Idées** — video ideas, their lifecycle status, and what they need (gear, dates).
- **Objets achetés** — gear/props bought for videos, reusable across ideas.
- **Chaîne YouTube** — connect the real channel via Google OAuth / YouTube Data API, link
  published videos back to the idea they came from, and compare performance across ideas with
  similar characteristics.

The app is meant to grow in complexity over time — the data model and IPC layer should stay easy
to extend rather than being treated as finished.

## Status: v2 — Tags, emoji, filters (done)

- **Tags**: a global `tags` table (name + color from a fixed preset palette), managed inline
  wherever they're picked (`src/renderer/src/features/tags/TagPicker.tsx` — chip toggles + a
  "+ Nouveau tag" inline mini-form, no separate tags-management screen). Linked to ideas via
  `idea_tags`; a `published_video_tags` join table also exists already, reserved for tagging
  fetched YouTube videos directly in the upcoming Channel milestone.
- **Emoji per idea**: a plain text `emoji` column on `ideas`, edited via a small text input in
  `IdeaFormModal` (relies on the OS-level emoji picker shortcut — no in-app picker library) and
  rendered as a prefix everywhere an idea's title appears (`IdeaCard`, `OverviewTab` lists).
- **Idea filters** (`IdeasTab`, via `IdeaFilters.tsx` + the pure `filterIdeas()` in
  `src/renderer/src/lib/ideaFilters.ts`): keyword (title+description substring), status (multi,
  effective status), tags (multi, with an "au moins un" / "tous" toggle), objects (multi, "at least
  one" semantics), and shoot/publish date each independently as either "any", an exact date, or a
  from/to range. All client-side over the already-fetched ideas list — no new IPC needed.

## Status: v3 — YouTube OAuth connection + video linking (done)

- **OAuth connection** (`src/main/youtube/oauth.ts`, `src/main/youtube/credentials.ts`): loopback
  HTTP server on a random `127.0.0.1` port + `shell.openExternal` to Google's consent screen,
  authorization code exchanged for access+refresh tokens, refresh token stored in
  `channel_connection` (singleton row) and silently refreshed on every API call whenever expired
  (`getValidAccessToken()`). Verified end-to-end with the user's real Google account — connects
  once, stays connected. Client credentials read from `credentials/google-oauth.json` (gitignored;
  falls back to `<userData>/google-oauth.json` for a packaged build), must be a Google **"Desktop
  app"**-type OAuth client (a "Web application" one was tried first and doesn't work — it requires
  pre-registering an exact redirect URI/port, whereas Desktop-app clients allow any loopback port).
- **Fetching recent videos** (`src/main/youtube/videos.ts`, `refreshRecentVideos()`): uploads
  playlist → `playlistItems.list` → `videos.list` for view/like/comment counts, plus a best-effort
  YouTube Analytics API call for `averageViewPercentage` (retention) that never blocks the rest of
  the fetch if it fails. Upserted into `published_videos` by `youtube_video_id`
  (`src/main/db/publishedVideos.ts`), preserving any existing `idea_id`/tags on refresh. This is a
  read-cache/explicit-refresh split: `channel:listVideos` reads the local cache only (cheap, safe
  to call on every relevant screen's mount via `useIdeasData`), `channel:refreshVideos` is the only
  one that hits the network, triggered by the Channel tab's "Actualiser les vidéos" button.
- **Idea ↔ real video linking**: from the Channel tab, a video can either become a brand-new idea
  (`createIdeaFromVideo` — title/status `published`/publishDate copied from the real video) or be
  linked to an existing not-yet-linked idea; from the Idées/Overview side, `IdeaFormModal` shows
  the linked video's stats + a clickable link when linked, or a picker of unlinked videos when not.
  Linking always syncs the idea's status to `published` and its `publishDate` to the video's real
  date (`markIdeaPublished()`), in both directions. `published_videos.idea_id` is the single
  relational link; `PublishedVideo.videoUrl` is derived, not stored
  (`https://www.youtube.com/shorts/<id>`).
- **Tags bridge between ideas and videos**: a linked video's `tagIds` ARE the linked idea's tags
  (read via `idea_tags`, not stored separately) — editing them happens on the idea, not the video.
  An unlinked video keeps its own direct tags in `published_video_tags`, editable straight from the
  Channel tab/video detail modal (`TagPicker` reused there too). This dual mode is intentional: it
  lets the future Analyse tab correlate tags with performance even for videos that predate having a
  local idea, while linked videos stay in sync with the idea automatically.
- Channel tab video list rows get a green highlight when linked (`ChannelVideoRow.tsx`); clicking a
  row opens `ChannelVideoDetailModal.tsx` ("la page dédiée") with the same linked-idea details.
- **`NOT_POSTED_STAT = -1`** (in `src/shared/types.ts`): the agreed sentinel for "this idea isn't
  linked to a posted video yet" wherever a view/like/comment count is shown for an idea. Not yet
  consumed anywhere (no per-idea stat display was built beyond the linked-video section in
  `IdeaFormModal`, which just omits stats entirely when unlinked) — **the constraint that matters
  going forward is for the Analyse tab (not built yet): any aggregation over view/like/comment
  counts MUST filter out `NOT_POSTED_STAT`/unlinked entries first**, never average them in as 0 or
  -1.

## Status: v1 — Ideas + Objects CRUD + Overview (done)

- Electron + React + TypeScript scaffold via `electron-vite`, Tailwind v4, `better-sqlite3` for
  local persistence (see `CLAUDE.md` for the architecture).
- **Idées tab**: create/edit/delete a video idea with title, description (hidden from the list
  view, only shown when editing), status (`idea → preparation → shooting → editing → ready →
scheduled → published`), shoot date, publish date, and a multi-select of needed objects pulled
  from the Objets tab. List view shows title, status badge, both dates, and needed-object chips —
  never the description.
- **Objets achetés tab**: create/edit/delete an object (name, description, purchase date, price,
  link, and an "Acheté" checkbox — toggleable directly on the card or via the form). Linked to
  ideas via the `idea_objects` join table.
- **Automatic "Préparation" status + missing-objects flag**: an idea's _effective_ status (computed
  client-side in `src/renderer/src/lib/ideaStatus.ts`, not stored) is forced to `preparation` —
  with a "Objets manquants" badge — whenever any of its linked objects has `purchased = false`,
  regardless of the manually-selected status (except once `published`). The stored `status` field
  is left untouched; only the display/count layer overrides it. This is why every screen that shows
  or counts statuses (`IdeaCard`, `OverviewTab`) goes through `getEffectiveStatus()` rather than
  reading `idea.status` directly.
- **Vue d'ensemble tab** (new, now the default/first tab): three stat cards (Prêtes + Programmées,
  À monter, À filmer — all counted via effective status), plus "Tournages aujourd'hui" and
  "Publication aujourd'hui" lists (filtered on `shootDate`/`publishDate` matching today), each item
  clickable to open the same idea edit modal used in the Idées tab.
- **Chaîne YouTube tab**: placeholder only — explains the planned OAuth integration, no
  functionality yet.
- Schema already has `channel_connection` and `published_videos` tables reserved (unused) for the
  next milestone.
- Data-fetching for ideas+objects was factored into `src/renderer/src/hooks/useIdeasData.ts`,
  shared by `IdeasTab` and `OverviewTab` (each still holds its own copy of the fetched state — no
  global store yet, just deduped fetch/refresh logic).
- Verified manually: app launches via `npm run dev`, the existing (pre-`purchased`-column) local DB
  migrates cleanly (`ALTER TABLE ... ADD COLUMN` guarded by `ensureColumn()` in
  `src/main/db/index.ts`), all four tabs render, typecheck/lint/build all pass clean.

## Next up (not started)

1. **Analyse tab** (new, last piece of the originally-scoped plan): pick a tag, list every
   `published_video` carrying it with its stats, compute average/best/worst view count (filtering
   out `NOT_POSTED_STAT` / unlinked-idea entries — see the v3 note above, this is the main
   correctness trap for this feature), and surface which other tags co-occur on those same videos.
   Comments were explicitly scoped to be fetched live on demand (Data API `commentThreads.list`)
   rather than persisted, to avoid unbounded local storage growth — no comments table planned.
2. Not yet designed, flagged by the user as wanted eventually: comparing an idea's tags against how
   similar-tagged videos actually performed (i.e. using the Analyse tab's per-tag stats to inform
   an idea still in the `idea`/`preparation` stage) — likely surfaces in `IdeaFormModal` once the
   Analyse tab's aggregation logic exists to reuse.

## Open decisions for whoever picks this up

- No versioned migration system for the DB yet (just `CREATE TABLE IF NOT EXISTS` +
  `ensureColumn()` for additive changes) — fine while the schema only grows, but altering/dropping
  columns later will need a real migration path.
- `refreshRecentVideos()` always fetches the most recent 25 uploads (`MAX_RECENT_VIDEOS` in
  `src/main/youtube/videos.ts`) — fine for now, but a channel with many more videos than that will
  never see its older uploads cached unless this is turned into paginated fetching.
