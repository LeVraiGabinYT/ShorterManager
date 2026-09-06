import type { Task } from '@shared/types'

// Earliest due date first; tasks with no due date sort last. No priority/weight/scheduling of any
// kind — just chronological order.
export function sortTasksChronologically(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      const dateCompare = a.dueDate.localeCompare(b.dueDate)
      if (dateCompare !== 0) return dateCompare
      return (a.dueTime ?? '').localeCompare(b.dueTime ?? '')
    }
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })
}

export function isTaskOverdue(task: Task, now: number = Date.now()): boolean {
  if (task.status !== 'pending') return false
  if (!task.dueDate) return false
  const time = task.dueTime ?? '23:59'
  const due = new Date(`${task.dueDate}T${time}`).getTime()
  return due < now
}
