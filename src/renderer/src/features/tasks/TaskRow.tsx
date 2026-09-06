import { useState, type ReactElement } from 'react'
import type { IdeaStatus, Task, TaskType, VideoIdea } from '@shared/types'
import { formatDate } from '../../lib/format'
import { taskColor } from '../../lib/taskTypeColors'
import { isTaskOverdue } from '../../lib/taskUrgency'

// The single task-row rendering used everywhere a task appears in a list (Tâches "Liste" and
// the Vue d'ensemble "Tâches à faire" section) — one look, one set of interactions, so a task
// behaves identically no matter where it's clicked from.
export interface TaskRowProps {
  task: Task
  taskTypesById: Map<number, TaskType>
  ideasById: Map<number, VideoIdea>
  statusColors: Record<IdeaStatus, string>
  conflicts: Task[]
  onToggleDone: (done: boolean) => void
  onEdit: () => void
  onOpenIdea: (idea: VideoIdea) => void
  onReschedule: (date: string, time: string) => void
  onCancel: () => void
  onDelete: () => void
}

export function TaskRow({
  task,
  taskTypesById,
  ideasById,
  statusColors,
  conflicts,
  onToggleDone,
  onEdit,
  onOpenIdea,
  onReschedule,
  onCancel,
  onDelete
}: TaskRowProps): ReactElement {
  const overdue = isTaskOverdue(task)
  const hasConflict = conflicts.length > 0
  const [rescheduling, setRescheduling] = useState(false)
  const [draftDate, setDraftDate] = useState(task.dueDate ?? '')
  const [draftTime, setDraftTime] = useState(task.dueTime ?? '')
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const types = task.typeIds.map((id) => taskTypesById.get(id)).filter((t): t is TaskType => !!t)
  const linkedIdeas = task.ideaIds.map((id) => ideasById.get(id)).filter((i): i is VideoIdea => !!i)
  const isClosed = task.status !== 'pending'
  const color = taskColor(task, taskTypesById, statusColors)

  return (
    <div
      style={
        overdue
          ? { borderColor: '#ef444466', backgroundColor: '#ef44440f' }
          : hasConflict
            ? { borderColor: '#f9731666', backgroundColor: '#f973160f' }
            : { borderColor: `${color}40`, backgroundColor: `${color}14` }
      }
      className={`rounded-lg border px-4 py-3 ${isClosed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.status === 'done'}
          onChange={(e) => onToggleDone(e.target.checked)}
          title="Marquer comme terminée"
          className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-emerald-600"
        />
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">{task.emoji || '✅'}</span>
            <span
              className={`font-medium ${isClosed ? 'text-gray-500 line-through' : 'text-gray-100'}`}
            >
              {task.title}
            </span>
            {hasConflict && (
              <span
                className="rounded-full border border-orange-500/50 bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-300"
                title={`Ordre de production incohérent avec : ${conflicts.map((c) => c.title).join(', ')}`}
              >
                ⚠️ Ordre incohérent
              </span>
            )}
            {task.status === 'canceled' && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-500">
                Annulée
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
            {task.dueDate && (
              <span className={overdue ? 'font-medium text-red-300' : ''}>
                📅 {formatDate(task.dueDate)}
                {task.dueTime ? ` à ${task.dueTime}` : ''}
              </span>
            )}
            {types.map((t) => (
              <span key={t.id}>
                {t.emoji} {t.name}
              </span>
            ))}
          </div>
          {linkedIdeas.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {linkedIdeas.map((idea) => (
                <button
                  type="button"
                  key={idea.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenIdea(idea)
                  }}
                  className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-gray-300 hover:border-blue-500/50 hover:text-blue-300"
                >
                  🎥 {idea.emoji ? `${idea.emoji} ` : ''}
                  {idea.title}
                </button>
              ))}
            </div>
          )}
        </button>
        <div className="shrink-0">
          {confirmingDelete ? (
            <span className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      {(overdue || hasConflict) && !rescheduling && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-7 text-xs">
          {overdue ? (
            <span className="text-red-300">En retard —</span>
          ) : (
            <span className="text-orange-300">
              Programmée avant « {conflicts.map((c) => c.title).join(', ')} » —
            </span>
          )}
          <button
            type="button"
            onClick={() => setRescheduling(true)}
            className="rounded-md border border-white/10 px-2 py-1 text-gray-300 hover:bg-white/5"
          >
            Reporter
          </button>
          {overdue &&
            (confirmingCancel ? (
              <span className="flex items-center gap-2">
                <span className="text-gray-400">Confirmer l’annulation ?</span>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500"
                >
                  Oui
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  Non
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="rounded-md border border-white/10 px-2 py-1 text-gray-300 hover:bg-white/5"
              >
                Annuler la tâche
              </button>
            ))}
        </div>
      )}

      {(overdue || hasConflict) && rescheduling && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-7 text-xs">
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-gray-100 outline-none [color-scheme:dark]"
          />
          <input
            type="time"
            value={draftTime}
            onChange={(e) => setDraftTime(e.target.value)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-gray-100 outline-none [color-scheme:dark]"
          />
          <button
            type="button"
            onClick={() => {
              onReschedule(draftDate, draftTime)
              setRescheduling(false)
            }}
            className="rounded-md bg-blue-600 px-2 py-1 font-medium text-white hover:bg-blue-500"
          >
            Valider
          </button>
          <button
            type="button"
            onClick={() => setRescheduling(false)}
            className="text-gray-400 hover:text-gray-200"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}
