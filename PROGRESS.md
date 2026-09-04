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

Roughly in the order the user described the feature, no firm priority beyond that:

1. **Google OAuth + YouTube Data API connection** (Chaîne YouTube tab)
   - OAuth flow inside Electron (likely a `BrowserWindow`-based flow or system browser +
     loopback, since Electron apps can't easily use `ASWebAuthenticationSession`-style flows —
     needs a design decision when picked up).
   - Store tokens in `channel_connection` (already in schema); handle refresh.
   - Fetch the connected channel's uploaded videos.
2. **Link ideas to published videos** — UI to attach a `published_videos` row to an `idea` (manual
   at first; auto-matching by title/date similarity could come later).
3. **Performance comparison** — once videos are linked, surface view/like/comment stats next to
   similar ideas (status/objects overlap) so the user can see what worked.
4. Likely needed along the way but not yet designed: idea search/filtering as the list grows,
   sorting options (currently newest-created-first only), and an "objects" section on the Overview
   tab (e.g. count of not-yet-purchased objects blocking ideas).

## Open decisions for whoever picks this up

- No decision made yet on the OAuth flow's UX inside Electron — flag this to the user before
  implementing, since it affects whether we need a custom protocol handler registered.
- No versioned migration system for the DB yet (just `CREATE TABLE IF NOT EXISTS`) — fine while
  the schema only grows, but altering/dropping columns later will need a real migration path.
