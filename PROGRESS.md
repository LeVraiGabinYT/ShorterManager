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

## Status: v3.1 — Searchable pickers + channel-wide video search (done)

Follow-up after real usage: with a channel posting daily, the plain `<select>`s for linking
ideas↔videos became unusable (too many entries to scroll), and `refreshRecentVideos()`'s 25-video
cap meant older videos (e.g. ~2 months back) were never even fetched, so no local search could find
them either.

- **`SearchablePicker`** (`src/renderer/src/components/SearchablePicker.tsx`, new, first
  cross-feature component in `components/`): a generic type-to-filter combobox replacing the old
  native `<select>`s in `IdeaFormModal` (picking a video to link) and `ChannelVideoDetailModal`
  (picking an idea to link). Always renders its input even with zero items (shows `emptyLabel`
  underneath instead) — the earlier version hid the input entirely on an empty list, which read as
  "the search field is missing" to the user.
- **Channel-wide video search** (`searchChannelVideos()` in `src/main/youtube/videos.ts`, IPC
  `channel:searchVideos`): calls the Data API's `search.list?forMine=true&type=video&q=...`
  endpoint — this searches _all_ of the channel's uploads, not just the cached most-recent-25 —
  then upserts any matches into `published_videos` via the same `upsertVideoMetas()` helper
  `refreshRecentVideos()` uses (extracted during this change). A search bar now sits above the
  video list in the Channel tab; results replace the list view until "Réinitialiser" is clicked.
  Because matches get cached on search, they immediately become linkable everywhere (the
  `IdeaFormModal` video picker included) without any extra plumbing.

## Status: v4 — Analyse tab: Explorer, Groups, Timeline, bulk actions (done)

The last piece of the originally-scoped plan. Three sub-tabs under a new "Analyse" tab
(`src/renderer/src/features/analysis/AnalysisTab.tsx`), all reading from `useIdeasData()`'s
`publishedVideos`/`ideas`/`tags`/`objects` — no dedicated backend query layer beyond the new
`analysis_groups` tables, everything else is computed client-side over already-fetched data.

- **Explorer** (`ExplorerPanel.tsx`): combinable filters (tags with an any/all toggle, objects,
  title keyword) over `published_videos`, via `filterPublishedVideos()` +
  `getVideoObjectIds()` in `src/renderer/src/lib/analysisFilters.ts` (a video's "objects" are its
  linked idea's objects — a video has none of its own). Results show a live `StatsSummary`
  (`computeVideoStats()` in `src/renderer/src/lib/videoStats.ts`: avg views/likes/comments/
  retention + best/worst, always excluding videos with a null `viewCount`) for the whole filtered
  set, plus a checkbox per video (and a "tout sélectionner") to build a custom subset and add it to
  a named group via `AddToGroupControl.tsx`.
- **Groups** (`GroupsPanel.tsx`): named, manually-curated video sets
  (`analysis_groups`/`analysis_group_videos` tables, `src/main/db/analysisGroups.ts`), rename
  inline, remove individual videos, check 2+ to compare their `StatsSummary`s side by side.
- **Timeline** (`TimelinePanel.tsx`): pick one tag, see every matching `published_video` (by real
  `publishedAt`) and every matching not-yet-linked idea (by `publishDate ?? shootDate`, "en
  préparation") in one chronological list, plus a stacked monthly bar chart (blue `#3987e5`
  published / orange `#d95926` in-préparation — the dataviz skill's validated adjacent categorical
  pair) to visually spot an overused topic. The chart and list share the same computed `entries`;
  the list is the required non-chart/accessible view of the same data.
- **Bulk actions**, added after first real usage exposed the gap:
  - Idées tab: every `IdeaCard` now has a selection checkbox (`selected`/`onToggleSelect` props;
    the card's wrapper became a `<div onClick>` instead of a `<button>` so the checkbox can
    `stopPropagation`), a "tout sélectionner" toggle for the currently filtered set, and a
    `BulkActionsBar.tsx` that can add a tag, add an object, or set a status across the whole
    selection at once (`toIdeaInput()` in `IdeasTab.tsx` rebuilds the full `VideoIdeaInput` each
    update requires — there's no partial-patch endpoint).
  - Channel tab: the video list (cached or search results) gained the same
    checkbox/"tout sélectionner" pattern plus `AddToGroupControl` (extracted out of `ExplorerPanel`
    into its own file specifically so both places could use it), so a multi-video search result can
    go straight into a group without visiting Explorer.
- **Duplicate-idea detection** (`DuplicateIdeaModal.tsx`, wired into `ChannelTab.handleAddToList`):
  before creating a new idea from a real video, checks for an existing idea whose trimmed title
  matches the video's exactly. If found, shows both side by side (date + tags) and offers "Fusionner
  et lier" (link to the existing idea instead of duplicating it) or "Créer quand même". The merge's
  tag-combining logic isn't special-cased in the renderer — it was pushed down into
  `linkVideoToIdea()` (`src/main/youtube/videos.ts`) as a general rule: **linking any video to any
  idea now always unions the video's own pre-link tags into the idea's**, so a previously
  independently-tagged unlinked video never silently loses its tags on link, duplicate-merge or not.
- **`PublishedVideo.description`** added (fetched from the Data API's `snippet.description`,
  already requested via the existing `part=snippet` on both the recent-videos and search calls —
  no extra quota cost) so Explorer's keyword filter can match description text the same way idea
  filtering already does for `idea.description`.

## Next up (not started)

Not yet designed, flagged by the user as wanted eventually: comparing an idea's tags against how
similar-tagged videos actually performed (i.e. using the Analyse tab's per-tag stats to inform an
idea still in the `idea`/`preparation` stage) — likely surfaces in `IdeaFormModal` once there's a
reason to reuse the Analyse tab's aggregation logic from outside it.

## Open decisions for whoever picks this up

- No versioned migration system for the DB yet (just `CREATE TABLE IF NOT EXISTS` +
  `ensureColumn()` for additive changes) — fine while the schema only grows, but altering/dropping
  columns later will need a real migration path.
- `refreshRecentVideos()` still only caches the most recent 25 uploads (`MAX_RECENT_VIDEOS`) —
  no longer a dead end now that `searchChannelVideos()` can reach older videos on demand by title,
  but there's still no way to browse/page through the _full_ upload history at once.
