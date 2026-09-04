# PROGRESS.md

Living status file for ShorterManager. Read this first when resuming work on the repo — it's the
"where did we leave off" doc. Update it whenever a milestone lands or the plan changes; don't let
it go stale. See `CLAUDE.md` for architecture/commands.

## Vision

A native macOS app for managing a YouTube channel's content pipeline end-to-end:
- **Idées** — video ideas, their lifecycle status, and what they need (gear, dates).
- **Objets achetés** — gear/props bought for videos, reusable across ideas.
- **Chaîne YouTube** — connect the real channel via Google OAuth / YouTube Data API, link
  published videos back to the idea they came from, and compare performance across ideas with
  similar characteristics.

The app is meant to grow in complexity over time — the data model and IPC layer should stay easy
to extend rather than being treated as finished.

## Status: v0 — Ideas + Objects CRUD (done)

- Electron + React + TypeScript scaffold via `electron-vite`, Tailwind v4, `better-sqlite3` for
  local persistence (see `CLAUDE.md` for the architecture).
- **Idées tab**: create/edit/delete a video idea with title, description (hidden from the list
  view, only shown when editing), status (`idea → shooting → editing → ready → scheduled →
  published`), shoot date, publish date, and a multi-select of needed objects pulled from the
  Objets tab. List view shows title, status badge, both dates, and needed-object chips — never the
  description.
- **Objets achetés tab**: create/edit/delete a purchased object (name, description, purchase date,
  price, link). Linked to ideas via the `idea_objects` join table.
- **Chaîne YouTube tab**: placeholder only — explains the planned OAuth integration, no
  functionality yet.
- Schema already has `channel_connection` and `published_videos` tables reserved (unused) for the
  next milestone.
- Verified manually: app launches via `npm run dev`, all three tabs render, typecheck/lint/build
  all pass clean.

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
   sorting options (currently newest-created-first only), and possibly richer statuses (e.g.
   separate "tournage prévu" vs "tourné").

## Open decisions for whoever picks this up

- No decision made yet on the OAuth flow's UX inside Electron — flag this to the user before
  implementing, since it affects whether we need a custom protocol handler registered.
- No versioned migration system for the DB yet (just `CREATE TABLE IF NOT EXISTS`) — fine while
  the schema only grows, but altering/dropping columns later will need a real migration path.
