import { useMemo, useState, type ReactElement } from 'react'
import type {
  Task,
  TaskInput,
  TaskType,
  TaskTypeInput,
  VideoIdea,
  VideoIdeaInput
} from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { formatDate } from '../../lib/format'
import {
  conflictsByTaskId,
  findWorkflowConflicts,
  sortTasksForDisplay
} from '../../lib/taskWorkflow'
import { IdeaFormModal } from '../ideas/IdeaFormModal'
import { TaskFormModal } from './TaskFormModal'
import { TaskRow } from './TaskRow'

type SubTab = 'liste' | 'proprietes'

function TaskTypeRow({
  type,
  dragged,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onRemove
}: {
  type: TaskType
  dragged: boolean
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
  onRemove: () => void
}): ReactElement {
  const [confirming, setConfirming] = useState(false)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      className={`flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 transition-opacity ${dragged ? 'opacity-40' : ''}`}
    >
      <span className="flex items-center gap-2 text-sm text-gray-200">
        <span
          className="cursor-grab select-none text-gray-500 active:cursor-grabbing"
          title="Glisser pour réordonner"
        >
          ⠿
        </span>
        <span className="text-lg">{type.emoji}</span>
        {type.name}
      </span>
      {confirming ? (
        <span className="flex items-center gap-2 text-xs">
          <span className="text-red-300">Supprimer ce type ?</span>
          <button
            onClick={onRemove}
            className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500"
          >
            Confirmer
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-gray-400 hover:text-gray-200"
          >
            Annuler
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
        >
          Supprimer
        </button>
      )}
    </div>
  )
}

function TaskTypesPanel({
  taskTypes,
  onCreate,
  onReorder,
  onRemove
}: {
  taskTypes: TaskType[]
  onCreate: (input: TaskTypeInput) => Promise<void>
  onReorder: (orderedIds: number[]) => Promise<void>
  onRemove: (id: number) => Promise<void>
}): ReactElement {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📌')
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [localOrder, setLocalOrder] = useState<number[] | null>(null)

  const orderedTypes = useMemo(() => {
    const byId = new Map(taskTypes.map((t) => [t.id, t]))
    const ids = localOrder ?? taskTypes.map((t) => t.id)
    return ids.map((id) => byId.get(id)).filter((t): t is TaskType => !!t)
  }, [taskTypes, localOrder])

  async function handleCreate(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) return
    await onCreate({ name: trimmed, emoji: emoji.trim() || '📌' })
    setName('')
    setEmoji('📌')
  }

  function handleDragEnter(targetId: number): void {
    if (draggedId === null || draggedId === targetId) return
    setLocalOrder((prev) => {
      const base = prev ?? taskTypes.map((t) => t.id)
      const next = base.filter((id) => id !== draggedId)
      next.splice(next.indexOf(targetId), 0, draggedId)
      return next
    })
  }

  async function handleDragEnd(): Promise<void> {
    setDraggedId(null)
    if (localOrder) await onReorder(localOrder)
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-2 text-sm font-medium text-gray-300">Nouveau type de tâche</h3>
        <div className="flex gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-14 shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-2 text-center text-lg outline-none focus:border-blue-500/60"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nom du type (ex: Miniature)"
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
          />
          <button
            onClick={handleCreate}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Ajouter
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-300">
          Ordre de production — glisse pour réordonner
        </h3>
        <p className="mb-2 text-xs text-gray-500">
          Cet ordre pilote le tri des tâches d’une même vidéo prévues le même jour, et
          l’avertissement affiché quand une étape est programmée avant une étape précédente.
        </p>
        <div className="space-y-2">
          {orderedTypes.map((type) => (
            <TaskTypeRow
              key={type.id}
              type={type}
              dragged={draggedId === type.id}
              onDragStart={() => setDraggedId(type.id)}
              onDragEnter={() => handleDragEnter(type.id)}
              onDragEnd={handleDragEnd}
              onRemove={() => onRemove(type.id)}
            />
          ))}
          {orderedTypes.length === 0 && (
            <p className="text-sm text-gray-500">Aucun type de tâche créé pour l’instant.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function TasksTab(): ReactElement {
  const {
    ideas,
    ideasById,
    objects,
    tags,
    series,
    publishedVideos,
    publishedVideosByIdeaId,
    taskTypes,
    taskTypesById,
    tasks,
    settings,
    loading,
    refresh
  } = useIdeasData()
  const [subTab, setSubTab] = useState<SubTab>('liste')
  const [creating, setCreating] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [openIdea, setOpenIdea] = useState<VideoIdea | null>(null)
  const [keyword, setKeyword] = useState('')
  const [typeFilterIds, setTypeFilterIds] = useState<number[]>([])

  const unlinkedVideos = useMemo(
    () => publishedVideos.filter((v) => v.ideaId === null),
    [publishedVideos]
  )

  const filteredTasks = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return tasks.filter((task) => {
      if (typeFilterIds.length > 0 && !task.typeIds.some((id) => typeFilterIds.includes(id))) {
        return false
      }
      if (kw && !task.title.toLowerCase().includes(kw)) return false
      return true
    })
  }, [tasks, keyword, typeFilterIds])

  const conflictsById = useMemo(
    () => conflictsByTaskId(findWorkflowConflicts(tasks, taskTypesById)),
    [tasks, taskTypesById]
  )

  const pendingTasks = useMemo(
    () =>
      sortTasksForDisplay(
        filteredTasks.filter((t) => t.status === 'pending'),
        taskTypesById
      ),
    [filteredTasks, taskTypesById]
  )
  const closedTasks = useMemo(
    () =>
      [...filteredTasks]
        .filter((t) => t.status !== 'pending')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [filteredTasks]
  )

  function toggleTypeFilter(id: number): void {
    setTypeFilterIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  async function handleCreate(input: TaskInput): Promise<void> {
    await window.api.tasks.create(input)
    setCreating(false)
    await refresh()
  }

  async function handleUpdate(input: TaskInput): Promise<void> {
    if (!editingTask) return
    await window.api.tasks.update(editingTask.id, input)
    setEditingTask(null)
    await refresh()
  }

  async function handleDelete(): Promise<void> {
    if (!editingTask) return
    await window.api.tasks.remove(editingTask.id)
    setEditingTask(null)
    await refresh()
  }

  async function handleDeleteTask(taskId: number): Promise<void> {
    await window.api.tasks.remove(taskId)
    await refresh()
  }

  async function handleToggleDone(taskId: number, done: boolean): Promise<void> {
    await window.api.tasks.setStatus(taskId, done ? 'done' : 'pending')
    await refresh()
  }

  async function handleReschedule(taskId: number, date: string, time: string): Promise<void> {
    await window.api.tasks.reschedule(taskId, date || null, time || null)
    await refresh()
  }

  async function handleCancelTask(taskId: number): Promise<void> {
    await window.api.tasks.setStatus(taskId, 'canceled')
    await refresh()
  }

  async function handleCreateType(input: TaskTypeInput): Promise<void> {
    await window.api.taskTypes.create(input)
    await refresh()
  }

  async function handleReorderTypes(orderedIds: number[]): Promise<void> {
    await window.api.taskTypes.reorder(orderedIds)
    await refresh()
  }

  async function handleRemoveType(id: number): Promise<void> {
    await window.api.taskTypes.remove(id)
    await refresh()
  }

  function handleOpenIdea(idea: VideoIdea): void {
    setEditingTask(null)
    setOpenIdea(idea)
  }

  async function handleUpdateIdea(input: VideoIdeaInput): Promise<void> {
    if (!openIdea) return
    await window.api.ideas.update(openIdea.id, input)
    setOpenIdea(null)
    await refresh()
  }

  async function handleDeleteIdea(): Promise<void> {
    if (!openIdea) return
    await window.api.ideas.remove(openIdea.id)
    setOpenIdea(null)
    await refresh()
  }

  async function handleLinkVideo(youtubeVideoId: string): Promise<void> {
    if (!openIdea) return
    await window.api.channel.linkVideoToIdea(youtubeVideoId, openIdea.id)
    await refresh()
  }

  async function handleUnlinkVideo(): Promise<void> {
    const linkedVideo = openIdea ? publishedVideosByIdeaId.get(openIdea.id) : null
    if (!linkedVideo) return
    await window.api.channel.unlinkVideo(linkedVideo.youtubeVideoId)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-100">Tâches</h1>
          <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            <button
              onClick={() => setSubTab('liste')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                subTab === 'liste' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Liste
            </button>
            <button
              onClick={() => setSubTab('proprietes')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                subTab === 'proprietes'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Propriétés
            </button>
          </div>
        </div>
        {subTab === 'liste' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreating(true)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              + Nouvelle tâche
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : subTab === 'proprietes' ? (
          <TaskTypesPanel
            taskTypes={taskTypes}
            onCreate={handleCreateType}
            onReorder={handleReorderTypes}
            onRemove={handleRemoveType}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Rechercher une tâche..."
                className="min-w-[200px] flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
              />
              <div className="flex flex-wrap gap-1.5">
                {taskTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleTypeFilter(type.id)}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      typeFilterIds.includes(type.id)
                        ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {type.emoji} {type.name}
                  </button>
                ))}
              </div>
              {(keyword || typeFilterIds.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setKeyword('')
                    setTypeFilterIds([])
                  }}
                  className="text-sm text-gray-500 hover:text-gray-300"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            <section>
              <h2 className="mb-2 text-sm font-medium text-gray-300">
                En attente ({pendingTasks.length})
              </h2>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune tâche en attente.</p>
              ) : (
                <div className="space-y-2">
                  {pendingTasks.map((task, index) => {
                    const previousTask = pendingTasks[index - 1]
                    const showDateSeparator = task.dueDate !== (previousTask?.dueDate ?? undefined)
                    return (
                      <div key={task.id}>
                        {showDateSeparator && (
                          <div className="mb-2 mt-4 flex items-center gap-2 first:mt-0">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                              {task.dueDate ? formatDate(task.dueDate) : 'Sans date'}
                            </span>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                        )}
                        <TaskRow
                          task={task}
                          taskTypesById={taskTypesById}
                          ideasById={ideasById}
                          statusColors={settings.statusColors}
                          conflicts={conflictsById.get(task.id) ?? []}
                          onToggleDone={(done) => handleToggleDone(task.id, done)}
                          onEdit={() => setEditingTask(task)}
                          onOpenIdea={handleOpenIdea}
                          onReschedule={(date, time) => handleReschedule(task.id, date, time)}
                          onCancel={() => handleCancelTask(task.id)}
                          onDelete={() => handleDeleteTask(task.id)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {closedTasks.length > 0 && (
              <section>
                <h2 className="mb-2 text-sm font-medium text-gray-500">
                  Terminées / annulées ({closedTasks.length})
                </h2>
                <div className="space-y-2">
                  {closedTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      taskTypesById={taskTypesById}
                      ideasById={ideasById}
                      statusColors={settings.statusColors}
                      conflicts={[]}
                      onToggleDone={(done) => handleToggleDone(task.id, done)}
                      onEdit={() => setEditingTask(task)}
                      onOpenIdea={handleOpenIdea}
                      onReschedule={(date, time) => handleReschedule(task.id, date, time)}
                      onCancel={() => handleCancelTask(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {creating && (
        <TaskFormModal
          task={null}
          taskTypes={taskTypes}
          taskTypesById={taskTypesById}
          ideas={ideas}
          otherTasks={tasks}
          onClose={() => setCreating(false)}
          onSave={handleCreate}
          onTaskTypesChanged={refresh}
          onOpenIdea={handleOpenIdea}
        />
      )}

      {editingTask && (
        <TaskFormModal
          task={editingTask}
          taskTypes={taskTypes}
          taskTypesById={taskTypesById}
          ideas={ideas}
          otherTasks={tasks}
          onClose={() => setEditingTask(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
          onTaskTypesChanged={refresh}
          onOpenIdea={handleOpenIdea}
        />
      )}

      {openIdea && (
        <IdeaFormModal
          idea={openIdea}
          objects={objects}
          tags={tags}
          series={series}
          existingIdeas={ideas}
          linkedVideo={publishedVideosByIdeaId.get(openIdea.id) ?? null}
          unlinkedVideos={unlinkedVideos}
          tasks={tasks}
          taskTypes={taskTypes}
          taskTypesById={taskTypesById}
          statusColors={settings.statusColors}
          onTasksChanged={refresh}
          ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
          onClose={() => setOpenIdea(null)}
          onSave={handleUpdateIdea}
          onDelete={handleDeleteIdea}
          onTagsChanged={refresh}
          onSeriesChanged={refresh}
          onLinkVideo={handleLinkVideo}
          onUnlinkVideo={handleUnlinkVideo}
        />
      )}
    </div>
  )
}
