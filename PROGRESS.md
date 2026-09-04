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

## Next up (not started) — currently being scoped/built with the user, in this order

1. **Google OAuth connection to the YouTube channel** (Chaîne YouTube tab) — "connect once" is a
   hard requirement.
   - Loopback-redirect flow: main process spins up a temporary local HTTP server on
     `127.0.0.1:<random port>`, opens the system browser to Google's consent screen
     (`shell.openExternal`, not a BrowserWindow — Google blocks OAuth in embedded webviews), Google
     redirects back to the loopback server with the auth code, exchanged server-side for
     access+refresh tokens.
   - Needs an OAuth Client ID of type **Desktop app** from Google Cloud Console (the user must
     create this — being walked through it live). Store the downloaded `client_secret_*.json`
     locally as `credentials/google-oauth.json` (gitignored), read only by the main process.
   - Scopes: `youtube.readonly` (channel + uploaded videos + comments — all via YouTube Data API
     v3) and `yt-analytics.readonly` (YouTube Analytics API — needed specifically for
     `averageViewPercentage`/retention, which the Data API does not expose).
   - For the refresh token to not expire after 7 days, the OAuth consent screen's publishing status
     must be **"In production"** (not "Testing") — the user will see an "unverified app" warning
     during consent (expected and fine for a personal-use app; verification is not required unless
     Google flags the scopes as "Restricted", which these are not).
   - Store tokens in `channel_connection` (id=1 singleton row, already in schema); refresh
     silently via the token endpoint whenever the access token is expired, before any API call.
   - `ChannelStatus` (connected/channelId/channelTitle — no tokens) is the only thing ever exposed
     to the renderer; tokens stay main-process-only.
2. **Fetch the channel's recent videos** into the Channel tab: title, thumbnail, view/like/comment
   counts (Data API `videos.list`), and average view percentage (Analytics API `reports.query`).
   Cache into `published_videos` (upsert by `youtube_video_id`); `PublishedVideo`/`ChannelStatus`
   types already exist in `src/shared/types.ts` for this.
3. **Tag a fetched video** directly from the Channel tab's video list, using the same `tags` table
   as ideas (`published_video_tags` join table already in schema).
4. **Analyse tab** (new): pick a tag, list every `published_video` carrying it with its stats,
   compute average/best/worst view count, and surface which other tags co-occur on those same
   videos. Comments are fetched live on demand (Data API `commentThreads.list`) rather than
   persisted — no comments table planned, to avoid unbounded local storage growth.
5. Not yet designed, flagged by the user as wanted eventually: linking a specific idea to the
   published video it became (manual at first), and comparing an idea's "predicted" tags against
   how similar-tagged videos actually performed.

## Open decisions for whoever picks this up

- OAuth flow is decided (loopback HTTP server + system browser, see above) — the only remaining
  blocker is the user completing the Google Cloud Console setup (project, enabled APIs, consent
  screen, Desktop app credentials) and saving the downloaded JSON to
  `credentials/google-oauth.json`. Once that file exists, wire up `src/main/youtube/oauth.ts`.
- No versioned migration system for the DB yet (just `CREATE TABLE IF NOT EXISTS`) — fine while
  the schema only grows, but altering/dropping columns later will need a real migration path.
