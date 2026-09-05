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

function ensureColumn(
  database: Database.Database,
  table: string,
  column: string,
  definition: string
): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!columns.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
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

  `)

  ensureColumn(database, 'objects', 'purchased', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(database, 'ideas', 'emoji', 'TEXT')
  ensureColumn(database, 'published_videos', 'thumbnail_url', 'TEXT')
  ensureColumn(database, 'published_videos', 'average_view_percentage', 'REAL')
  ensureColumn(database, 'published_videos', 'description', 'TEXT')
  ensureColumn(database, 'ideas', 'series_id', 'INTEGER REFERENCES series(id) ON DELETE SET NULL')

  // The "analysis groups" feature (named, manually-curated video sets for comparison) was
  // replaced by the unified Analyse tab's ad-hoc dataset builder — drop its now-unused tables.
  database.exec(`
    DROP TABLE IF EXISTS analysis_group_videos;
    DROP TABLE IF EXISTS analysis_groups;
  `)
}
