import type { IdeaStatus, Task, TaskType } from '@shared/types'

// Which status color a task borrows, based on its type's name — keeps a task's look consistent
// with the pipeline stage it belongs to (an "Achat" task looks like "Préparation", a "Tournage"
// task looks like "Tournage", etc). A task with no recognized type falls back to neutral gray.
const TASK_TYPE_STATUS: Record<string, IdeaStatus> = {
  Achat: 'preparation',
  Tournage: 'shooting',
  Montage: 'editing',
  Publication: 'scheduled'
}

const DEFAULT_TASK_COLOR = '#6b7280'

export function taskColor(
  task: Task,
  taskTypesById: Map<number, TaskType>,
  statusColors: Record<IdeaStatus, string>
): string {
  for (const typeId of task.typeIds) {
    const type = taskTypesById.get(typeId)
    const status = type ? TASK_TYPE_STATUS[type.name] : undefined
    if (status) return statusColors[status]
  }
  return DEFAULT_TASK_COLOR
}
