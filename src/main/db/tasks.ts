import { getDb } from './index'
import type { Task, TaskInput, TaskStatus } from '../../shared/types'

interface TaskRow {
  id: number
  title: string
  emoji: string | null
  due_date: string | null
  due_time: string | null
  status: TaskStatus
  created_at: string
  updated_at: string
}

function getTypeIds(taskId: number): number[] {
  const rows = getDb()
    .prepare('SELECT task_type_id FROM task_type_links WHERE task_id = ?')
    .all(taskId) as { task_type_id: number }[]
  return rows.map((r) => r.task_type_id)
}

function getIdeaIds(taskId: number): number[] {
  const rows = getDb().prepare('SELECT idea_id FROM task_ideas WHERE task_id = ?').all(taskId) as {
    idea_id: number
  }[]
  return rows.map((r) => r.idea_id)
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    dueDate: row.due_date,
    dueTime: row.due_time,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    typeIds: getTypeIds(row.id),
    ideaIds: getIdeaIds(row.id)
  }
}

function setTaskTypes(taskId: number, typeIds: number[]): void {
  const db = getDb()
  db.prepare('DELETE FROM task_type_links WHERE task_id = ?').run(taskId)
  const insert = db.prepare('INSERT INTO task_type_links (task_id, task_type_id) VALUES (?, ?)')
  for (const typeId of typeIds) insert.run(taskId, typeId)
}

function setTaskIdeas(taskId: number, ideaIds: number[]): void {
  const db = getDb()
  db.prepare('DELETE FROM task_ideas WHERE task_id = ?').run(taskId)
  const insert = db.prepare('INSERT INTO task_ideas (task_id, idea_id) VALUES (?, ?)')
  for (const ideaId of ideaIds) insert.run(taskId, ideaId)
}

function getTaskById(id: number): Task {
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow
  return toTask(row)
}

// Plain chronological order — earliest due date first, tasks with no due date last, ties broken
// by creation order. No automatic creation, no priority/weight/scheduling of any kind.
export function listTasks(): Task[] {
  const rows = getDb()
    .prepare('SELECT * FROM tasks ORDER BY due_date IS NULL, due_date ASC, id ASC')
    .all() as TaskRow[]
  return rows.map(toTask)
}

export function createTask(input: TaskInput): Task {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO tasks (title, emoji, due_date, due_time, status)
       VALUES (@title, @emoji, @dueDate, @dueTime, @status)`
    )
    .run({
      title: input.title,
      emoji: input.emoji,
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      status: input.status
    })

  const taskId = result.lastInsertRowid as number
  setTaskTypes(taskId, input.typeIds)
  setTaskIdeas(taskId, input.ideaIds)
  return getTaskById(taskId)
}

export function updateTask(id: number, input: TaskInput): Task {
  const db = getDb()
  db.prepare(
    `UPDATE tasks SET
       title = @title,
       emoji = @emoji,
       due_date = @dueDate,
       due_time = @dueTime,
       status = @status,
       updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    title: input.title,
    emoji: input.emoji,
    dueDate: input.dueDate,
    dueTime: input.dueTime,
    status: input.status
  })

  setTaskTypes(id, input.typeIds)
  setTaskIdeas(id, input.ideaIds)
  return getTaskById(id)
}

export function setTaskStatus(id: number, status: TaskStatus): Task {
  getDb()
    .prepare(`UPDATE tasks SET status = @status, updated_at = datetime('now') WHERE id = @id`)
    .run({ id, status })
  return getTaskById(id)
}

/** Reporting an overdue task to a new date/time always brings it back to "pending". */
export function rescheduleTask(id: number, dueDate: string | null, dueTime: string | null): Task {
  getDb()
    .prepare(
      `UPDATE tasks SET
         due_date = @dueDate,
         due_time = @dueTime,
         status = 'pending',
         updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({ id, dueDate, dueTime })
  return getTaskById(id)
}

export function removeTask(id: number): void {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

export function removeTasks(ids: number[]): void {
  const db = getDb()
  const del = db.prepare('DELETE FROM tasks WHERE id = ?')
  const txn = db.transaction((taskIds: number[]) => {
    for (const taskId of taskIds) del.run(taskId)
  })
  txn(ids)
}
