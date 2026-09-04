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

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS objects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      purchase_date TEXT,
      price REAL,
      link TEXT,
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

    -- Réservé pour lier une idée à une vidéo publiée et comparer les performances.
    CREATE TABLE IF NOT EXISTS published_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
      youtube_video_id TEXT NOT NULL UNIQUE,
      title TEXT,
      published_at TEXT,
      view_count INTEGER,
      like_count INTEGER,
      comment_count INTEGER,
      stats_fetched_at TEXT
    );
  `)
}
