import { useMemo, useState, type FormEvent, type ReactElement } from 'react'
import type { Task, TaskInput, TaskType, VideoIdea } from '@shared/types'
import { SearchablePicker } from '../../components/SearchablePicker'
import { findWorkflowConflicts } from '../../lib/taskWorkflow'
import { TaskTypePicker } from './TaskTypePicker'

interface TaskFormModalProps {
  task: Task | null
  taskTypes: TaskType[]
  taskTypesById?: Map<number, TaskType>
  ideas: VideoIdea[]
  defaultIdeaId?: number | null
  // Every other task, used only to warn live if this task's date/type would put it out of
  // production order relative to another step of the same linked idea — never required.
  otherTasks?: Task[]
  onClose: () => void
  onSave: (input: TaskInput) => void
  onDelete?: () => void
  onTaskTypesChanged: () => void
  // Lets the user jump straight from a linked task to that idea's own details (bidirectional
  // navigation) — omitted where there's nowhere sensible to open it (e.g. not provided).
  onOpenIdea?: (idea: VideoIdea) => void
}

export function TaskFormModal({
  task,
  taskTypes,
  taskTypesById,
  ideas,
  defaultIdeaId = null,
  otherTasks = [],
  onClose,
  onSave,
  onDelete,
  onTaskTypesChanged,
  onOpenIdea
}: TaskFormModalProps): ReactElement {
  const [title, setTitle] = useState(task?.title ?? '')
  const [emoji, setEmoji] = useState(task?.emoji ?? '✅')
  const [typeIds, setTypeIds] = useState<number[]>(task?.typeIds ?? [])
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [dueTime, setDueTime] = useState(task?.dueTime ?? '')
  const [status, setStatus] = useState<TaskInput['status']>(task?.status ?? 'pending')
  const [ideaIds, setIdeaIds] = useState<number[]>(
    task?.ideaIds ?? (defaultIdeaId !== null ? [defaultIdeaId] : [])
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const ideasById = new Map(ideas.map((i) => [i.id, i]))
  const linkedIdeas = ideaIds.map((id) => ideasById.get(id)).filter((i): i is VideoIdea => !!i)
  const unlinkedIdeas = ideas.filter((i) => !ideaIds.includes(i.id))

  const draftConflicts = useMemo(() => {
    if (!taskTypesById || !dueDate) return []
    const draftId = task?.id ?? -1
    const draft: Task = {
      id: draftId,
      title: title.trim() || 'Cette tâche',
      emoji: null,
      dueDate,
      dueTime: dueTime || null,
      status: 'pending',
      createdAt: '',
      updatedAt: '',
      typeIds,
      ideaIds
    }
    const others = otherTasks.filter((t) => t.id !== draftId)
    return findWorkflowConflicts([draft, ...others], taskTypesById).filter(
      (c) => c.earlierStage.id === draftId || c.laterStage.id === draftId
    )
  }, [task?.id, title, dueDate, dueTime, typeIds, ideaIds, otherTasks, taskTypesById])

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    onSave({
      title: trimmedTitle,
      emoji: emoji.trim() || null,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      status,
      typeIds,
      ideaIds
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-white/10 bg-[#15161a] shadow-2xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 className="text-lg font-semibold text-gray-100">
            {task ? 'Modifier la tâche' : 'Nouvelle tâche'}
          </h2>

          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <div className="w-16 shrink-0">
                <label className="mb-1 block text-xs font-medium text-gray-400">Émoji</label>
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="✅"
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-2 text-center text-lg outline-none focus:border-blue-500/60"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-400">Titre</label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
                  placeholder="Titre de la tâche"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Types de tâche</label>
              <TaskTypePicker
                taskTypes={taskTypes}
                selectedIds={typeIds}
                onChange={setTypeIds}
                onTaskTypesChanged={onTaskTypesChanged}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Heure</label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
                />
              </div>
            </div>

            {draftConflicts.length > 0 && (
              <p className="rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-300">
                ⚠️ Ordre de production incohérent : « {title.trim() || 'Cette tâche'} » est
                programmée{' '}
                {draftConflicts.map((c, i) => {
                  const isDraftEarlier = c.earlierStage.id === (task?.id ?? -1)
                  const other = isDraftEarlier ? c.laterStage : c.earlierStage
                  return (
                    <span key={other.id}>
                      {i > 0 && ', '}
                      {isDraftEarlier ? 'après' : 'avant'} « {other.title} »
                    </span>
                  )
                })}
                . Pense à reprogrammer l’une des deux tâches.
              </p>
            )}

            {task && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskInput['status'])}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
                >
                  <option value="pending" className="bg-[#15161a]">
                    En attente
                  </option>
                  <option value="done" className="bg-[#15161a]">
                    Validée
                  </option>
                  <option value="canceled" className="bg-[#15161a]">
                    Annulée
                  </option>
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">Idées liées</label>
              {linkedIdeas.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {linkedIdeas.map((idea) => (
                    <span
                      key={idea.id}
                      className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-200"
                    >
                      {onOpenIdea ? (
                        <button
                          type="button"
                          onClick={() => onOpenIdea(idea)}
                          className="flex items-center gap-1 hover:text-blue-300 hover:underline"
                          title="Ouvrir cette idée"
                        >
                          {idea.emoji && <span>{idea.emoji}</span>}
                          {idea.title}
                        </button>
                      ) : (
                        <>
                          {idea.emoji && <span>{idea.emoji}</span>}
                          {idea.title}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setIdeaIds((prev) => prev.filter((id) => id !== idea.id))}
                        className="ml-1 text-gray-500 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <SearchablePicker
                items={unlinkedIdeas}
                getKey={(idea) => idea.id}
                getLabel={(idea) => idea.title}
                onSelect={(idea) => setIdeaIds((prev) => [...prev, idea.id])}
                placeholder="Lier une idée de vidéo..."
                emptyLabel="Aucune autre idée disponible."
              />
            </div>

            {onDelete && (
              <div className="mt-6 border-t border-white/10 pt-4">
                {confirmingDelete ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-300">Supprimer définitivement cette tâche ?</span>
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
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="rounded-md px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  )
}
