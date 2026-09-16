import { getDb } from './index'
import type { InspirationBoard } from '../../shared/types'

interface InspirationBoardRow {
  id: number
  name: string
  position: number
}

function toBoard(row: InspirationBoardRow): InspirationBoard {
  return { id: row.id, name: row.name, position: row.position }
}

export function listInspirationBoards(): InspirationBoard[] {
  const rows = getDb()
    .prepare('SELECT * FROM inspiration_boards ORDER BY position ASC, id ASC')
    .all() as InspirationBoardRow[]
  return rows.map(toBoard)
}

export function createInspirationBoard(name: string): InspirationBoard {
  const db = getDb()
  const { maxPosition } = db
    .prepare('SELECT COALESCE(MAX(position), -1) as maxPosition FROM inspiration_boards')
    .get() as { maxPosition: number }
  const result = db
    .prepare('INSERT INTO inspiration_boards (name, position) VALUES (?, ?)')
    .run(name.trim() || 'Mind map', maxPosition + 1)
  const id = result.lastInsertRowid as number
  const row = db
    .prepare('SELECT * FROM inspiration_boards WHERE id = ?')
    .get(id) as InspirationBoardRow
  return toBoard(row)
}

export function renameInspirationBoard(id: number, name: string): InspirationBoard {
  const db = getDb()
  db.prepare(
    "UPDATE inspiration_boards SET name = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name.trim() || 'Mind map', id)
  const row = db
    .prepare('SELECT * FROM inspiration_boards WHERE id = ?')
    .get(id) as InspirationBoardRow
  return toBoard(row)
}

export function reorderInspirationBoards(orderedIds: number[]): void {
  const db = getDb()
  const update = db.prepare('UPDATE inspiration_boards SET position = ? WHERE id = ?')
  const txn = db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(index, id))
  })
  txn()
}

// Never allows removing the last remaining board — the mind map must always have somewhere to
// live; the renderer disables the delete action accordingly, this is just the backstop.
export function removeInspirationBoard(id: number): boolean {
  const db = getDb()
  const { count } = db.prepare('SELECT COUNT(*) as count FROM inspiration_boards').get() as {
    count: number
  }
  if (count <= 1) return false
  db.prepare('DELETE FROM inspiration_boards WHERE id = ?').run(id)
  return true
}

// Backup-import-only: inserts a board preserving its EXACT original id, used by a full-app
// "replace" import so restored boards match the backup file byte-for-byte (see main/backup.ts).
export function insertInspirationBoardWithId(board: InspirationBoard): void {
  getDb()
    .prepare('INSERT INTO inspiration_boards (id, name, position) VALUES (?, ?, ?)')
    .run(board.id, board.name, board.position)
}
