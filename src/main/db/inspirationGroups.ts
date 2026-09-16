import { getDb } from './index'
import type { InspirationGroup, InspirationGroupInput } from '../../shared/types'

interface InspirationGroupRow {
  id: number
  board_id: number
  title: string
  color: string
  pos_x: number
  pos_y: number
  width: number
  height: number
}

function toGroup(row: InspirationGroupRow): InspirationGroup {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    color: row.color,
    posX: row.pos_x,
    posY: row.pos_y,
    width: row.width,
    height: row.height
  }
}

export function listInspirationGroups(boardId: number): InspirationGroup[] {
  const rows = getDb()
    .prepare('SELECT * FROM inspiration_groups WHERE board_id = ? ORDER BY created_at ASC')
    .all(boardId) as InspirationGroupRow[]
  return rows.map(toGroup)
}

export function createInspirationGroup(input: InspirationGroupInput): InspirationGroup {
  const result = getDb()
    .prepare(
      `INSERT INTO inspiration_groups (board_id, title, color, pos_x, pos_y, width, height)
       VALUES (@boardId, @title, @color, @posX, @posY, @width, @height)`
    )
    .run(input)
  return getInspirationGroupById(result.lastInsertRowid as number)
}

export function updateInspirationGroup(id: number, input: InspirationGroupInput): InspirationGroup {
  getDb()
    .prepare(
      `UPDATE inspiration_groups SET
         title = @title, color = @color, pos_x = @posX, pos_y = @posY,
         width = @width, height = @height, updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({ ...input, id })
  return getInspirationGroupById(id)
}

export function removeInspirationGroup(id: number): void {
  getDb().prepare('DELETE FROM inspiration_groups WHERE id = ?').run(id)
}

function getInspirationGroupById(id: number): InspirationGroup {
  const row = getDb()
    .prepare('SELECT * FROM inspiration_groups WHERE id = ?')
    .get(id) as InspirationGroupRow
  return toGroup(row)
}

// --- Backup / import-export support (used by main/backup.ts and main/inspirationsBackup.ts) ---

// Mirrors replaceAllInspirations() in db/inspirations.ts: wipes every group ON THE GIVEN BOARD
// and re-inserts the given set with their EXACT original ids, for a "replace" import.
export function replaceAllInspirationGroups(boardId: number, groups: InspirationGroup[]): void {
  const db = getDb()
  db.prepare('DELETE FROM inspiration_groups WHERE board_id = ?').run(boardId)
  const insert = db.prepare(
    `INSERT INTO inspiration_groups (id, board_id, title, color, pos_x, pos_y, width, height)
     VALUES (@id, @boardId, @title, @color, @posX, @posY, @width, @height)`
  )
  for (const group of groups) insert.run({ ...group, boardId })
}

// Mirrors addInspirationsFromBackup() — a group has no natural "same as" key either, so a "merge"
// import always adds every group as a brand-new row onto the given board.
export function addInspirationGroupsFromBackup(
  boardId: number,
  groups: InspirationGroup[]
): number {
  for (const group of groups) {
    createInspirationGroup({
      boardId,
      title: group.title,
      color: group.color,
      posX: group.posX,
      posY: group.posY,
      width: group.width,
      height: group.height
    })
  }
  return groups.length
}
