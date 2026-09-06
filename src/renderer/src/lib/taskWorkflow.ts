import type { Task, TaskType } from '@shared/types'

// Reads TaskType.position directly — the same value the user sets by drag-and-drop in Propriétés
// (onglet Tâches). Nothing here is hardcoded by name: reordering a type there immediately changes
// same-day task ordering and which tasks get flagged as "ordre incohérent" below. A task with no
// type at all carries no known position and is excluded from both checks.
export function workflowPosition(task: Task, taskTypesById: Map<number, TaskType>): number | null {
  const positions = task.typeIds
    .map((id) => taskTypesById.get(id)?.position)
    .filter((p): p is number => p !== undefined)
  return positions.length > 0 ? Math.min(...positions) : null
}

// Same day, ascending due date, but when two tasks land on the same day (and neither has a
// specific time that would otherwise place it relative to other ideas' tasks that day), a video's
// own production steps are kept in their logical order rather than left to creation order.
export function sortTasksForDisplay(tasks: Task[], taskTypesById: Map<number, TaskType>): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) {
      const dateCompare = a.dueDate.localeCompare(b.dueDate)
      if (dateCompare !== 0) return dateCompare
    } else if (a.dueDate) {
      return -1
    } else if (b.dueDate) {
      return 1
    }

    if (a.dueTime && b.dueTime && a.dueTime !== b.dueTime) {
      return a.dueTime.localeCompare(b.dueTime)
    }

    const sameIdea = a.ideaIds[0] !== undefined && a.ideaIds[0] === b.ideaIds[0]
    if (sameIdea) {
      const posA = workflowPosition(a, taskTypesById)
      const posB = workflowPosition(b, taskTypesById)
      if (posA !== null && posB !== null && posA !== posB) return posA - posB
    }

    return 0
  })
}

export interface WorkflowConflict {
  earlierStage: Task // the task whose type comes first in the workflow (e.g. Tournage)
  laterStage: Task // the task whose type comes after it (e.g. Montage), scheduled too soon
}

// Does task a's schedule fall strictly before task b's? Only decisive with a real date difference,
// or a same-day difference where both carry a specific time — same day with no times is treated as
// ambiguous, not a violation, to avoid false positives.
function isBefore(a: Task, b: Task): boolean {
  if (!a.dueDate || !b.dueDate) return false
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate
  if (a.dueTime && b.dueTime) return a.dueTime < b.dueTime
  return false
}

// A task is inconsistent when a LATER production step of the same idea is scheduled strictly
// before an EARLIER one still pending — e.g. Montage due before its video's Tournage. Only pending
// tasks with a due date and at least one type are considered (a type's position always exists once
// it's been created, so any two typed tasks of the same idea can be compared).
export function findWorkflowConflicts(
  tasks: Task[],
  taskTypesById: Map<number, TaskType>
): WorkflowConflict[] {
  const byIdea = new Map<number, Task[]>()
  for (const task of tasks) {
    if (task.status !== 'pending' || !task.dueDate) continue
    if (workflowPosition(task, taskTypesById) === null) continue
    const ideaId = task.ideaIds[0]
    if (ideaId === undefined) continue
    const list = byIdea.get(ideaId) ?? []
    list.push(task)
    byIdea.set(ideaId, list)
  }

  const conflicts: WorkflowConflict[] = []
  for (const group of byIdea.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = [group[i], group[j]]
        const posA = workflowPosition(a, taskTypesById) as number
        const posB = workflowPosition(b, taskTypesById) as number
        if (posA === posB) continue
        const [earlierStage, laterStage] = posA < posB ? [a, b] : [b, a]
        if (isBefore(laterStage, earlierStage)) conflicts.push({ earlierStage, laterStage })
      }
    }
  }
  return conflicts
}

// Every task involved in at least one conflict, mapped to the other task(s) it conflicts with —
// used to warn on BOTH sides (the reader doesn't know from one row alone which date is "wrong").
export function conflictsByTaskId(conflicts: WorkflowConflict[]): Map<number, Task[]> {
  const map = new Map<number, Task[]>()
  function add(id: number, other: Task): void {
    const list = map.get(id) ?? []
    list.push(other)
    map.set(id, list)
  }
  for (const { earlierStage, laterStage } of conflicts) {
    add(earlierStage.id, laterStage)
    add(laterStage.id, earlierStage)
  }
  return map
}
