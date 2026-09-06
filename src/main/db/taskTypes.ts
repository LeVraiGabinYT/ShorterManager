import { getDb } from './index'
import type { TaskType, TaskTypeInput } from '../../shared/types'

interface TaskTypeRow {
  id: number
  name: string
  emoji: string
  position: number
  created_at: string
}

function toTaskType(row: TaskTypeRow): TaskType {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    position: row.position,
    createdAt: row.created_at
  }
}

export function listTaskTypes(): TaskType[] {
  const rows = getDb()
    .prepare('SELECT * FROM task_types ORDER BY position ASC, id ASC')
    .all() as TaskTypeRow[]
  return rows.map(toTaskType)
}

function nextPosition(): number {
  const row = getDb().prepare('SELECT MAX(position) AS maxPosition FROM task_types').get() as {
    maxPosition: number | null
  }
  return (row.maxPosition ?? -1) + 1
}

export function createTaskType(input: TaskTypeInput): TaskType {
  const result = getDb()
    .prepare('INSERT INTO task_types (name, emoji, position) VALUES (@name, @emoji, @position)')
    .run({ name: input.name, emoji: input.emoji || '📌', position: nextPosition() })
  return getTaskTypeById(result.lastInsertRowid as number)
}

// Persists a full drag-and-drop reorder from the Propriétés screen — position becomes each id's
// index in the given array. This is what the same-day task ordering and the "ordre incohérent"
// warning both read, so dragging a type here directly changes that behavior.
export function reorderTaskTypes(orderedIds: number[]): TaskType[] {
  const db = getDb()
  const update = db.prepare('UPDATE task_types SET position = ? WHERE id = ?')
  const txn = db.transaction((ids: number[]) => {
    ids.forEach((id, index) => update.run(index, id))
  })
  txn(orderedIds)
  return listTaskTypes()
}

export function removeTaskType(id: number): void {
  getDb().prepare('DELETE FROM task_types WHERE id = ?').run(id)
}

function getTaskTypeById(id: number): TaskType {
  const row = getDb().prepare('SELECT * FROM task_types WHERE id = ?').get(id) as TaskTypeRow
  return toTaskType(row)
}
