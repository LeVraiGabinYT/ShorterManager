import { getDb } from './index'
import type { TaskType, TaskTypeInput } from '../../shared/types'

interface TaskTypeRow {
  id: number
  name: string
  emoji: string
  created_at: string
}

function toTaskType(row: TaskTypeRow): TaskType {
  return { id: row.id, name: row.name, emoji: row.emoji, createdAt: row.created_at }
}

export function listTaskTypes(): TaskType[] {
  const rows = getDb().prepare('SELECT * FROM task_types ORDER BY name ASC').all() as TaskTypeRow[]
  return rows.map(toTaskType)
}

export function createTaskType(input: TaskTypeInput): TaskType {
  const result = getDb()
    .prepare('INSERT INTO task_types (name, emoji) VALUES (@name, @emoji)')
    .run({ name: input.name, emoji: input.emoji || '📌' })
  return getTaskTypeById(result.lastInsertRowid as number)
}

export function removeTaskType(id: number): void {
  getDb().prepare('DELETE FROM task_types WHERE id = ?').run(id)
}

function getTaskTypeById(id: number): TaskType {
  const row = getDb().prepare('SELECT * FROM task_types WHERE id = ?').get(id) as TaskTypeRow
  return toTaskType(row)
}
