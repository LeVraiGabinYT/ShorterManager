import type { Task } from '@shared/types'

export function isTaskOverdue(task: Task, now: number = Date.now()): boolean {
  if (task.status !== 'pending') return false
  if (!task.dueDate) return false
  const time = task.dueTime ?? '23:59'
  const due = new Date(`${task.dueDate}T${time}`).getTime()
  return due < now
}
