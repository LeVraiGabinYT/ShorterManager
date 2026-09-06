import type { IdeaStatus, Task, TaskType, VideoIdea } from '@shared/types'

const STAGE_INDEX: Record<IdeaStatus, number> = {
  idea: 0,
  preparation: 1,
  shooting: 2,
  editing: 3,
  ready: 4,
  scheduled: 5,
  published: 6
}
const FINAL_STAGE = 6

// Where each default task type sits along the production pipeline — used to keep a video's own
// tasks in the order they actually have to happen in (you can't edit before shooting, can't
// publish before editing, can't shoot without the objects bought first...).
const TYPE_PIPELINE_POSITION: Record<string, number> = {
  Achat: 1,
  Tournage: 2,
  Montage: 3,
  Publication: 5
}
const DEFAULT_PIPELINE_POSITION = 3

function daysUntil(dateStr: string, now: number): number {
  const target = new Date(dateStr.slice(0, 10)).getTime()
  const today = new Date(new Date(now).toISOString().slice(0, 10)).getTime()
  return (target - today) / 86_400_000
}

function taskPipelinePosition(task: Task, taskTypesById: Map<number, TaskType>): number {
  const positions = task.typeIds
    .map((id) => taskTypesById.get(id)?.name)
    .map((name) => (name ? TYPE_PIPELINE_POSITION[name] : undefined))
    .filter((p): p is number => p !== undefined)
  return positions.length > 0 ? Math.min(...positions) : DEFAULT_PIPELINE_POSITION
}

/**
 * There's no manual "priority" — urgency is entirely derived from context:
 *  - deadlinePressure: how close the linked idea's publish date (or shoot date, or the task's own
 *    due date as a last resort) is. Decays over three weeks; overdue pushes it higher still.
 *  - stagesRemaining: how many production stages are left before the idea is published. This is
 *    the dominant term on purpose — a video due in 3 days that's still at "Idée" has a LOT left to
 *    do, so every one of its tasks (buying objects, shooting...) needs to visibly jump the queue
 *    now, not wait until each one's own date is close. This is what "spreads work out" instead of
 *    piling it all up against the deadline.
 *  - pipelinePosition: subtracted, so among tasks for the same idea, the earliest blocking step
 *    (Achat, then Tournage, then Montage, then Publication) naturally ranks first — matching the
 *    real dependency order (no scheduling an unfinished video, no editing an unshot one, etc).
 */
export function taskUrgencyScore(
  task: Task,
  taskTypesById: Map<number, TaskType>,
  ideasById: Map<number, VideoIdea>,
  now: number = Date.now()
): number {
  const linkedIdeas = task.ideaIds.map((id) => ideasById.get(id)).filter((i): i is VideoIdea => !!i)
  const primaryIdea = linkedIdeas[0] ?? null

  const deadline = primaryIdea?.publishDate ?? primaryIdea?.shootDate ?? task.dueDate
  const deadlinePressure = deadline ? Math.max(0, 21 - daysUntil(deadline, now)) : 0

  const stagesRemaining = primaryIdea ? FINAL_STAGE - STAGE_INDEX[primaryIdea.status] : 0

  const pipelinePosition = taskPipelinePosition(task, taskTypesById)

  return deadlinePressure * 2 + stagesRemaining * 3 - pipelinePosition
}

export function sortTasksByUrgency(
  tasks: Task[],
  taskTypesById: Map<number, TaskType>,
  ideasById: Map<number, VideoIdea>,
  now: number = Date.now()
): Task[] {
  return [...tasks].sort(
    (a, b) =>
      taskUrgencyScore(b, taskTypesById, ideasById, now) -
      taskUrgencyScore(a, taskTypesById, ideasById, now)
  )
}

/** Pure pipeline order (Achat → Tournage → Montage → Publication), ignoring deadline/urgency —
 * used to show a single idea's own tasks in the order they have to be done. */
export function sortTasksByPipeline(tasks: Task[], taskTypesById: Map<number, TaskType>): Task[] {
  return [...tasks].sort(
    (a, b) => taskPipelinePosition(a, taskTypesById) - taskPipelinePosition(b, taskTypesById)
  )
}

export function isTaskOverdue(task: Task, now: number = Date.now()): boolean {
  if (task.status !== 'pending') return false
  if (!task.dueDate) return false
  const time = task.dueTime ?? '23:59'
  const due = new Date(`${task.dueDate}T${time}`).getTime()
  return due < now
}
