import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'shorter-manager.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)

  return db
}

// Returns true when the column was actually added by this call, so migrate() can run a one-time
// backfill for it (and only for it) instead of re-running backfill logic on every startup.
function ensureColumn(
  database: Database.Database,
  table: string,
  column: string,
  definition: string
): boolean {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (columns.some((c) => c.name === column)) return false
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS objects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      purchase_date TEXT,
      price REAL,
      link TEXT,
      purchased INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'idea',
      publish_date TEXT,
      shoot_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS idea_objects (
      idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      object_id INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
      PRIMARY KEY (idea_id, object_id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS idea_tags (
      idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (idea_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS published_video_tags (
      published_video_id INTEGER NOT NULL REFERENCES published_videos(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (published_video_id, tag_id)
    );

    -- An idea belongs to at most one série (nullable FK on ideas, see ensureColumn below).
    CREATE TABLE IF NOT EXISTS series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Réservé pour la future intégration OAuth Google / YouTube Data API.
    CREATE TABLE IF NOT EXISTS channel_connection (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      channel_id TEXT,
      channel_title TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry TEXT,
      connected_at TEXT
    );

    -- Vidéos réellement publiées sur la chaîne, optionnellement liées à une idée locale.
    CREATE TABLE IF NOT EXISTS published_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
      youtube_video_id TEXT NOT NULL UNIQUE,
      title TEXT,
      thumbnail_url TEXT,
      published_at TEXT,
      view_count INTEGER,
      like_count INTEGER,
      comment_count INTEGER,
      average_view_percentage REAL,
      stats_fetched_at TEXT
    );

    CREATE TABLE IF NOT EXISTS task_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      emoji TEXT NOT NULL DEFAULT '📌',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      emoji TEXT,
      due_date TEXT,
      due_time TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_type_links (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      task_type_id INTEGER NOT NULL REFERENCES task_types(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, task_type_id)
    );

    CREATE TABLE IF NOT EXISTS task_ideas (
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, idea_id)
    );

    -- Onglet Inspirations: any number of independent mind-map boards (see main/db/
    -- inspirationBoards.ts) — each inspiration/group belongs to exactly one via board_id
    -- (ensureColumn below; nullable in SQLite terms but always backfilled to a real board by
    -- ensureDefaultBoard()).
    CREATE TABLE IF NOT EXISTS inspiration_boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Mind map',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- A freeform mind-map card, entirely independent from ideas/objects elsewhere in the app (an
    -- inspiration "objet" is its own lightweight record, never the dashboard's OwnedObject) — see
    -- main/db/inspirations.ts.
    CREATE TABLE IF NOT EXISTS inspirations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      emoji TEXT,
      description_html TEXT NOT NULL DEFAULT '',
      pos_x REAL NOT NULL DEFAULT 0,
      pos_y REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inspiration_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspiration_id INTEGER NOT NULL REFERENCES inspirations(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      label TEXT,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inspiration_objects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspiration_id INTEGER NOT NULL REFERENCES inspirations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      link TEXT,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inspiration_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspiration_id INTEGER NOT NULL REFERENCES inspirations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      value TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0
    );

    -- Undirected connections between two inspiration cards (the mind-map's lines). Canonicalized
    -- to from_id < to_id at write time (see createInspirationLink) so the UNIQUE constraint
    -- actually prevents a duplicate link regardless of which card the user dragged from.
    CREATE TABLE IF NOT EXISTS inspiration_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id INTEGER NOT NULL REFERENCES inspirations(id) ON DELETE CASCADE,
      to_id INTEGER NOT NULL REFERENCES inspirations(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (from_id, to_id)
    );

    -- A purely geometric colored rectangle drawn behind cards on the mind-map canvas, used to
    -- visually cluster nodes ("encadrés") — no membership list is kept, a card is "in" a frame
    -- simply by being positioned inside its bounds.
    CREATE TABLE IF NOT EXISTS inspiration_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#3b82f6',
      pos_x REAL NOT NULL DEFAULT 0,
      pos_y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL DEFAULT 320,
      height REAL NOT NULL DEFAULT 240,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

  `)

  ensureColumn(database, 'objects', 'purchased', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(database, 'ideas', 'emoji', 'TEXT')
  ensureColumn(database, 'published_videos', 'thumbnail_url', 'TEXT')
  ensureColumn(database, 'published_videos', 'average_view_percentage', 'REAL')
  ensureColumn(database, 'published_videos', 'description', 'TEXT')
  ensureColumn(database, 'ideas', 'series_id', 'INTEGER REFERENCES series(id) ON DELETE SET NULL')
  ensureColumn(database, 'series', 'emoji', "TEXT NOT NULL DEFAULT '🎬'")
  // Rich-text (HTML) script for the video, written directly on the idea — see ScriptEditor.
  ensureColumn(database, 'ideas', 'script', 'TEXT')
  // Content format ('short' | 'long') — defaults every existing idea to 'short' on upgrade, since
  // that's what the app only ever supported before this column existed.
  ensureColumn(database, 'ideas', 'format', "TEXT NOT NULL DEFAULT 'short'")

  // Onglet Stats' channel-wide totals (abonnés, vues, nombre de vidéos) — cached here rather than
  // re-fetched on every Stats tab open, only refreshed on its explicit "Actualiser" button.
  ensureColumn(database, 'channel_connection', 'subscriber_count', 'INTEGER')
  ensureColumn(database, 'channel_connection', 'hidden_subscriber_count', 'INTEGER')
  ensureColumn(database, 'channel_connection', 'total_view_count', 'INTEGER')
  ensureColumn(database, 'channel_connection', 'video_count', 'INTEGER')
  ensureColumn(database, 'channel_connection', 'channel_stats_fetched_at', 'TEXT')

  // Inspirations nodes started out as a single "idea" kind — kind/video_url/video_thumbnail_url
  // were added later for the 'youtube_video' node type (see main/youtube/oembed.ts), backfilled
  // to 'idea' for every existing row.
  ensureColumn(database, 'inspirations', 'kind', "TEXT NOT NULL DEFAULT 'idea'")
  ensureColumn(database, 'inspirations', 'video_url', 'TEXT')
  ensureColumn(database, 'inspirations', 'video_thumbnail_url', 'TEXT')
  // 'title'/'text' node kinds carry their own background/font color and title font size instead
  // of the default card styling.
  ensureColumn(database, 'inspirations', 'background_color', 'TEXT')
  ensureColumn(database, 'inspirations', 'font_color', 'TEXT')
  ensureColumn(database, 'inspirations', 'font_size', 'INTEGER')
  // An 'idea' node can optionally mirror a real dashboard idea — stats (views/likes/comments) and
  // status are never copied onto this row, only the id: they're always resolved live from
  // ideas/published_videos at read time (see main/db/inspirations.ts) so a channel stats refresh
  // is reflected on every board without any extra sync step.
  ensureColumn(
    database,
    'inspirations',
    'linked_idea_id',
    'INTEGER REFERENCES ideas(id) ON DELETE SET NULL'
  )
  // Multiple independent mind-map boards — every existing inspiration/group predates this and
  // gets backfilled onto a freshly-created default board by ensureDefaultBoard() below.
  ensureColumn(
    database,
    'inspirations',
    'board_id',
    'INTEGER REFERENCES inspiration_boards(id) ON DELETE CASCADE'
  )
  ensureColumn(
    database,
    'inspiration_groups',
    'board_id',
    'INTEGER REFERENCES inspiration_boards(id) ON DELETE CASCADE'
  )
  ensureDefaultBoard(database)

  // Task types keep a user-orderable "position" (drag-and-drop, Propriétés) — used to detect a
  // task scheduled out of production order and to break same-day ties, but never to auto-create
  // or auto-schedule tasks. An install from before this existed gets its types positioned by id
  // order, which for the seeded defaults already reconstructs Achat -> Tournage -> Montage ->
  // Publication.
  const addedTypePosition = ensureColumn(
    database,
    'task_types',
    'position',
    'INTEGER NOT NULL DEFAULT 0'
  )
  if (addedTypePosition) {
    const rows = database.prepare('SELECT id FROM task_types ORDER BY id ASC').all() as {
      id: number
    }[]
    const update = database.prepare('UPDATE task_types SET position = ? WHERE id = ?')
    rows.forEach((row, index) => update.run(index, row.id))
  }

  // The automatic task-generation/scheduling system (weight, capacity, auto-created tasks) has
  // been removed entirely — tasks are plain, manually-created, chronological items again. An
  // install that still has the old columns/rows from that system just carries harmless orphan
  // columns; this only needs to purge the stale auto-generated task rows themselves, since nothing
  // will ever resolve or update them again.
  const hasAutoGeneratedColumn = (
    database.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]
  ).some((c) => c.name === 'auto_generated')
  if (hasAutoGeneratedColumn) {
    database.exec('DELETE FROM tasks WHERE auto_generated = 1')
  }

  // The "analysis groups" feature (named, manually-curated video sets for comparison) was
  // replaced by the unified Analyse tab's ad-hoc dataset builder — drop its now-unused tables.
  database.exec(`
    DROP TABLE IF EXISTS analysis_group_videos;
    DROP TABLE IF EXISTS analysis_groups;
  `)

  seedDefaultTaskTypes(database)
}

// Guarantees at least one mind-map board exists, and that every inspiration/group predating the
// multi-board feature (board_id still NULL) lands on a real one — runs on every startup but is a
// no-op past the first time (only ever touches NULL board_id rows).
export function ensureDefaultBoard(database: Database.Database): void {
  const { count } = database.prepare('SELECT COUNT(*) as count FROM inspiration_boards').get() as {
    count: number
  }
  let defaultBoardId: number
  if (count === 0) {
    const result = database
      .prepare("INSERT INTO inspiration_boards (name, position) VALUES ('Mind map 1', 0)")
      .run()
    defaultBoardId = result.lastInsertRowid as number
  } else {
    const row = database
      .prepare('SELECT id FROM inspiration_boards ORDER BY position ASC, id ASC LIMIT 1')
      .get() as { id: number }
    defaultBoardId = row.id
  }
  database
    .prepare('UPDATE inspirations SET board_id = ? WHERE board_id IS NULL')
    .run(defaultBoardId)
  database
    .prepare('UPDATE inspiration_groups SET board_id = ? WHERE board_id IS NULL')
    .run(defaultBoardId)
}

// Seeded once, only if the table is empty — the user can rename or delete these afterwards like
// any other task type, this just gives them a sensible starting point.
function seedDefaultTaskTypes(database: Database.Database): void {
  const { count } = database.prepare('SELECT COUNT(*) as count FROM task_types').get() as {
    count: number
  }
  if (count > 0) return

  const insert = database.prepare('INSERT INTO task_types (name, emoji, position) VALUES (?, ?, ?)')
  // Position is just this array's index, so the workflow starts in production order — fully
  // reorderable by the user afterwards.
  const defaults: [string, string][] = [
    ['Achat', '🛒'],
    ['Tournage', '🎬'],
    ['Montage', '🎞️'],
    ['Publication', '📤']
  ]
  defaults.forEach(([name, emoji], position) => insert.run(name, emoji, position))
}
