import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import type {
  IdeaStatus,
  OverviewSectionId,
  OwnedObject,
  OwnedObjectInput,
  Series,
  Tag,
  Task,
  TaskInput,
  TaskType,
  VideoIdea,
  VideoIdeaInput
} from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { formatPrice, formatRelativeTime, formatDate } from '../../lib/format'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { ideaUrgencyDate, objectsToBuy, sortByUrgency, type ObjectToBuy } from '../../lib/priority'
import { overviewSectionColor } from '../../lib/sectionColors'
import {
  conflictsByTaskId,
  findWorkflowConflicts,
  sortTasksForDisplay
} from '../../lib/taskWorkflow'
import { IdeaFormModal } from '../ideas/IdeaFormModal'
import { IdeaListRow } from '../ideas/IdeaListRow'
import { ObjectFormModal } from '../objects/ObjectFormModal'
import { TaskFormModal } from '../tasks/TaskFormModal'
import { TaskRow } from '../tasks/TaskRow'

const IN_PROGRESS_STATUSES: IdeaStatus[] = ['preparation', 'shooting', 'editing', 'ready']

// Fixed accents for the top stat cards — deliberately independent from the customizable status
// colors, so this row keeps a stable, distinct look no matter what the user picks in Paramètres.
const SCHEDULED_CARD_COLOR = '#10b981'
const LAST_SHORT_CARD_COLOR = '#3b82f6'
const IN_PROGRESS_CARD_COLOR = '#f97316'
const IDEAS_CARD_COLOR = '#06b6d4'

interface StatCardProps {
  label: string
  value: ReactNode
  subtext?: string
  color: string
  capitalizeValue?: boolean
  navigateLabel?: string
  onNavigate?: () => void
}

function StatCard({
  label,
  value,
  subtext,
  color,
  capitalizeValue,
  navigateLabel,
  onNavigate
}: StatCardProps): ReactElement {
  return (
    <div
      style={{ backgroundColor: `${color}14`, borderColor: `${color}40` }}
      className="rounded-lg border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-3xl font-semibold ${capitalizeValue ? 'capitalize' : ''}`}
          style={{ color }}
        >
          {value}
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="mt-1 flex shrink-0 items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-200"
          >
            {navigateLabel}
            <span aria-hidden>→</span>
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-400">{label}</p>
      {subtext && <p className="mt-0.5 text-xs text-gray-500">{subtext}</p>}
    </div>
  )
}

interface IdeaListSectionProps {
  title: string
  emptyLabel: string
  ideas: VideoIdea[]
  objectsById: Map<number, OwnedObject>
  seriesById: Map<number, Series>
  tagsById: Map<number, Tag>
  statusColors: Record<IdeaStatus, string>
  showTags: boolean
  ruleMissingObjectsPreparation: boolean
  pendingTaskCountByIdeaId: Map<number, number>
  color: string
  onSelect: (idea: VideoIdea) => void
}

function IdeaListSection({
  title,
  emptyLabel,
  ideas,
  objectsById,
  seriesById,
  tagsById,
  statusColors,
  showTags,
  ruleMissingObjectsPreparation,
  pendingTaskCountByIdeaId,
  color,
  onSelect
}: IdeaListSectionProps): ReactElement {
  return (
    <div
      style={{ backgroundColor: `${color}14`, borderColor: `${color}40` }}
      className="rounded-lg border"
    >
      <h2 className="px-4 pt-3 pb-2 text-sm font-medium text-gray-200">
        {title} ({ideas.length})
      </h2>
      {ideas.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <div className="border-t border-white/10">
          {ideas.map((idea) => (
            <IdeaListRow
              key={idea.id}
              idea={idea}
              objectsById={objectsById}
              seriesById={seriesById}
              tagsById={tagsById}
              statusColors={statusColors}
              showTags={showTags}
              ruleMissingObjectsPreparation={ruleMissingObjectsPreparation}
              pendingTaskCount={pendingTaskCountByIdeaId.get(idea.id) ?? 0}
              onClick={() => onSelect(idea)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ObjectsToBuySectionProps {
  entries: ObjectToBuy[]
  color: string
  onTogglePurchased: (object: OwnedObject) => void
  onSelect: (object: OwnedObject) => void
}

function ObjectsToBuySection({
  entries,
  color,
  onTogglePurchased,
  onSelect
}: ObjectsToBuySectionProps): ReactElement {
  return (
    <div
      style={{ backgroundColor: `${color}14`, borderColor: `${color}40` }}
      className="rounded-lg border"
    >
      <h2 className="px-4 pt-3 pb-2 text-sm font-medium text-gray-200">
        Objets à acheter ({entries.length})
      </h2>
      {entries.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-gray-500">Rien à acheter pour l’instant.</p>
      ) : (
        <div className="border-t border-white/10">
          {entries.map(({ object, nearestDate, neededByIdeas }) => (
            <div
              key={object.id}
              onClick={() => onSelect(object)}
              className="flex w-full cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 hover:bg-white/[0.04]"
            >
              <input
                type="checkbox"
                checked={false}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onTogglePurchased(object)}
                className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-blue-600"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-100">{object.name}</span>
                  {object.price !== null && (
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatPrice(object.price)}
                    </span>
                  )}
                </div>
                {neededByIdeas.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    Pour : {neededByIdeas.map((idea) => idea.title).join(', ')}
                  </p>
                )}
              </div>

              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  nearestDate
                    ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                    : 'border-white/10 bg-white/5 text-gray-500'
                }`}
              >
                {nearestDate ? formatDate(nearestDate) : 'Pas de date'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface TasksSectionProps {
  tasks: Task[]
  taskTypesById: Map<number, TaskType>
  ideasById: Map<number, VideoIdea>
  statusColors: Record<IdeaStatus, string>
  conflictsById: Map<number, Task[]>
  color: string
  onEdit: (task: Task) => void
  onOpenIdea: (idea: VideoIdea) => void
  onToggleDone: (taskId: number, done: boolean) => void
  onReschedule: (taskId: number, date: string, time: string) => void
  onCancel: (taskId: number) => void
  onDelete: (taskId: number) => void
  onNavigateToTasks: () => void
}

// Identical rendering to the Tâches "Liste" page (same TaskRow component) — a task looks and
// behaves the same whether you're checking it off from here or from the dedicated tab.
function TasksSection({
  tasks,
  taskTypesById,
  ideasById,
  statusColors,
  conflictsById,
  color,
  onEdit,
  onOpenIdea,
  onToggleDone,
  onReschedule,
  onCancel,
  onDelete,
  onNavigateToTasks
}: TasksSectionProps): ReactElement {
  return (
    <div
      style={{ backgroundColor: `${color}14`, borderColor: `${color}40` }}
      className="rounded-lg border p-2"
    >
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <h2 className="text-sm font-medium text-gray-200">Tâches du jour ({tasks.length})</h2>
        <button
          type="button"
          onClick={onNavigateToTasks}
          className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-200"
        >
          Voir les tâches
          <span aria-hidden>→</span>
        </button>
      </div>
      {tasks.length === 0 ? (
        <p className="px-2 pb-2 text-sm text-gray-500">Rien à faire aujourd’hui.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              taskTypesById={taskTypesById}
              ideasById={ideasById}
              statusColors={statusColors}
              conflicts={conflictsById.get(task.id) ?? []}
              onToggleDone={(done) => onToggleDone(task.id, done)}
              onEdit={() => onEdit(task)}
              onOpenIdea={onOpenIdea}
              onReschedule={(date, time) => onReschedule(task.id, date, time)}
              onCancel={() => onCancel(task.id)}
              onDelete={() => onDelete(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface OverviewTabProps {
  onNavigateToTasks: () => void
  onNavigateToIdeas: () => void
  onNavigateToInProgress: () => void
}

export function OverviewTab({
  onNavigateToTasks,
  onNavigateToIdeas,
  onNavigateToInProgress
}: OverviewTabProps): ReactElement {
  const {
    ideas,
    objects,
    objectsById,
    tags,
    tagsById,
    series,
    seriesById,
    publishedVideos,
    publishedVideosByIdeaId,
    tasks,
    taskTypes,
    taskTypesById,
    ideasById,
    pendingTaskCountByIdeaId,
    settings,
    loading,
    refresh
  } = useIdeasData()
  const [selectedIdea, setSelectedIdea] = useState<VideoIdea | null>(null)
  const [editingObject, setEditingObject] = useState<OwnedObject | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const unlinkedVideos = useMemo(
    () => publishedVideos.filter((v) => v.ideaId === null),
    [publishedVideos]
  )

  const effective = useMemo(
    () =>
      ideas.map((idea) => ({
        idea,
        ...getEffectiveStatus(idea, objectsById, settings.ruleMissingObjectsPreparation)
      })),
    [ideas, objectsById, settings.ruleMissingObjectsPreparation]
  )

  const scheduledCount = effective.filter((e) => e.status === 'scheduled').length
  const inProgressCount = effective.filter((e) => IN_PROGRESS_STATUSES.includes(e.status)).length
  const readyCount = effective.filter((e) => e.status === 'ready').length
  const ideaCount = effective.filter((e) => e.status === 'idea').length

  // The most recently published idea — its publish date (falling back to shoot date) is what
  // "Dernier Short" measures time against.
  const lastPublishedIdea = useMemo(() => {
    return effective
      .filter((e) => e.status === 'published')
      .map((e) => e.idea)
      .reduce<VideoIdea | null>((latest, idea) => {
        const date = idea.publishDate ?? idea.shootDate
        if (!date) return latest
        const latestDate = latest ? (latest.publishDate ?? latest.shootDate) : null
        if (!latest || !latestDate || new Date(date).getTime() > new Date(latestDate).getTime()) {
          return idea
        }
        return latest
      }, null)
  }, [effective])
  const lastShortLabel = lastPublishedIdea
    ? formatRelativeTime(lastPublishedIdea.publishDate ?? lastPublishedIdea.shootDate)
    : 'Aucun'

  // Each list is sorted by whichever of an idea's shoot/publish date is soonest, so the most
  // urgent ideas — the ones with a deadline coming up — always surface at the top.
  const preparationIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'preparation').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )
  const shootingIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'shooting').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )
  const editingIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'editing').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )
  const toScheduleIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'ready').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )
  const scheduledIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'scheduled').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )

  const objectsNeeded = useMemo(() => objectsToBuy(objects, ideas), [objects, ideas])

  // Vue d'ensemble only ever shows what's due today or already overdue — everything further out
  // stays on the dedicated Tâches page so this section doesn't get cluttered with future work.
  const pendingTasks = useMemo(() => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return sortTasksForDisplay(
      tasks.filter((t) => t.status === 'pending' && t.dueDate !== null && t.dueDate <= todayStr),
      taskTypesById
    )
  }, [tasks, taskTypesById])
  const conflictsById = useMemo(
    () => conflictsByTaskId(findWorkflowConflicts(tasks, taskTypesById)),
    [tasks, taskTypesById]
  )

  const sectionElements: Record<OverviewSectionId, ReactElement> = {
    preparation: (
      <IdeaListSection
        title="À préparer"
        emptyLabel="Aucune idée à préparer."
        ideas={preparationIdeas}
        objectsById={objectsById}
        seriesById={seriesById}
        tagsById={tagsById}
        statusColors={settings.statusColors}
        showTags={settings.showTagsOnIdeaCard}
        ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
        pendingTaskCountByIdeaId={pendingTaskCountByIdeaId}
        color={overviewSectionColor('preparation', settings.statusColors)}
        onSelect={setSelectedIdea}
      />
    ),
    objects: (
      <ObjectsToBuySection
        entries={objectsNeeded}
        color={overviewSectionColor('objects', settings.statusColors)}
        onTogglePurchased={handleToggleObjectPurchased}
        onSelect={setEditingObject}
      />
    ),
    shooting: (
      <IdeaListSection
        title="Tournages"
        emptyLabel="Aucun tournage à prévoir."
        ideas={shootingIdeas}
        objectsById={objectsById}
        seriesById={seriesById}
        tagsById={tagsById}
        statusColors={settings.statusColors}
        showTags={settings.showTagsOnIdeaCard}
        ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
        pendingTaskCountByIdeaId={pendingTaskCountByIdeaId}
        color={overviewSectionColor('shooting', settings.statusColors)}
        onSelect={setSelectedIdea}
      />
    ),
    editing: (
      <IdeaListSection
        title="Montages"
        emptyLabel="Aucune vidéo à monter."
        ideas={editingIdeas}
        objectsById={objectsById}
        seriesById={seriesById}
        tagsById={tagsById}
        statusColors={settings.statusColors}
        showTags={settings.showTagsOnIdeaCard}
        ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
        pendingTaskCountByIdeaId={pendingTaskCountByIdeaId}
        color={overviewSectionColor('editing', settings.statusColors)}
        onSelect={setSelectedIdea}
      />
    ),
    toSchedule: (
      <IdeaListSection
        title="À programmer"
        emptyLabel="Aucune vidéo prête à programmer."
        ideas={toScheduleIdeas}
        objectsById={objectsById}
        seriesById={seriesById}
        tagsById={tagsById}
        statusColors={settings.statusColors}
        showTags={settings.showTagsOnIdeaCard}
        ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
        pendingTaskCountByIdeaId={pendingTaskCountByIdeaId}
        color={overviewSectionColor('toSchedule', settings.statusColors)}
        onSelect={setSelectedIdea}
      />
    ),
    scheduled: (
      <IdeaListSection
        title="Prochaines publications"
        emptyLabel="Aucune vidéo programmée."
        ideas={scheduledIdeas}
        objectsById={objectsById}
        seriesById={seriesById}
        tagsById={tagsById}
        statusColors={settings.statusColors}
        showTags={settings.showTagsOnIdeaCard}
        ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
        pendingTaskCountByIdeaId={pendingTaskCountByIdeaId}
        color={overviewSectionColor('scheduled', settings.statusColors)}
        onSelect={setSelectedIdea}
      />
    ),
    tasks: (
      <TasksSection
        tasks={pendingTasks}
        taskTypesById={taskTypesById}
        ideasById={ideasById}
        statusColors={settings.statusColors}
        conflictsById={conflictsById}
        color={overviewSectionColor('tasks', settings.statusColors)}
        onEdit={setEditingTask}
        onOpenIdea={setSelectedIdea}
        onToggleDone={handleToggleTaskDone}
        onReschedule={handleRescheduleTask}
        onCancel={handleCancelTask}
        onDelete={handleDeleteTaskById}
        onNavigateToTasks={onNavigateToTasks}
      />
    )
  }

  async function handleUpdate(input: VideoIdeaInput): Promise<void> {
    if (!selectedIdea) return
    await window.api.ideas.update(selectedIdea.id, input)
    setSelectedIdea(null)
    await refresh()
  }

  async function handleDelete(): Promise<void> {
    if (!selectedIdea) return
    await window.api.ideas.remove(selectedIdea.id)
    setSelectedIdea(null)
    await refresh()
  }

  async function handleLinkVideo(youtubeVideoId: string): Promise<void> {
    if (!selectedIdea) return
    await window.api.channel.linkVideoToIdea(youtubeVideoId, selectedIdea.id)
    await refresh()
  }

  async function handleUnlinkVideo(): Promise<void> {
    const linkedVideo = selectedIdea ? publishedVideosByIdeaId.get(selectedIdea.id) : null
    if (!linkedVideo) return
    await window.api.channel.unlinkVideo(linkedVideo.youtubeVideoId)
    await refresh()
  }

  async function handleToggleObjectPurchased(obj: OwnedObject): Promise<void> {
    await window.api.objects.update(obj.id, {
      name: obj.name,
      description: obj.description,
      purchaseDate: obj.purchaseDate,
      price: obj.price,
      link: obj.link,
      purchased: true
    })
    await refresh()
  }

  async function handleUpdateObject(input: OwnedObjectInput): Promise<void> {
    if (!editingObject) return
    await window.api.objects.update(editingObject.id, input)
    setEditingObject(null)
    await refresh()
  }

  async function handleDeleteObject(): Promise<void> {
    if (!editingObject) return
    await window.api.objects.remove(editingObject.id)
    setEditingObject(null)
    await refresh()
  }

  async function handleUpdateTask(input: TaskInput): Promise<void> {
    if (!editingTask) return
    await window.api.tasks.update(editingTask.id, input)
    setEditingTask(null)
    await refresh()
  }

  async function handleDeleteTask(): Promise<void> {
    if (!editingTask) return
    await window.api.tasks.remove(editingTask.id)
    setEditingTask(null)
    await refresh()
  }

  async function handleDeleteTaskById(taskId: number): Promise<void> {
    await window.api.tasks.remove(taskId)
    await refresh()
  }

  async function handleToggleTaskDone(taskId: number, done: boolean): Promise<void> {
    await window.api.tasks.setStatus(taskId, done ? 'done' : 'pending')
    await refresh()
  }

  async function handleRescheduleTask(taskId: number, date: string, time: string): Promise<void> {
    await window.api.tasks.reschedule(taskId, date || null, time || null)
    await refresh()
  }

  async function handleCancelTask(taskId: number): Promise<void> {
    await window.api.tasks.setStatus(taskId, 'canceled')
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Vue d’ensemble</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Vidéos programmées"
                value={scheduledCount}
                color={SCHEDULED_CARD_COLOR}
              />
              <StatCard
                label="Dernier Short"
                value={lastShortLabel}
                capitalizeValue
                color={LAST_SHORT_CARD_COLOR}
              />
              <StatCard
                label="Vidéos en cours"
                value={inProgressCount}
                subtext={`Dont ${readyCount} prête${readyCount > 1 ? 's' : ''}`}
                color={IN_PROGRESS_CARD_COLOR}
                navigateLabel="Voir les vidéos en cours"
                onNavigate={onNavigateToInProgress}
              />
              <StatCard
                label="Idées de vidéos"
                value={ideaCount}
                color={IDEAS_CARD_COLOR}
                navigateLabel="Voir les idées"
                onNavigate={onNavigateToIdeas}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {settings.overviewSectionOrder
                .filter((id) => settings.overviewVisibleSections.includes(id))
                .map((id) => (
                  <div key={id}>{sectionElements[id]}</div>
                ))}
            </div>
          </div>
        )}
      </div>

      {selectedIdea && (
        <IdeaFormModal
          idea={selectedIdea}
          objects={objects}
          tags={tags}
          series={series}
          existingIdeas={ideas}
          linkedVideo={publishedVideosByIdeaId.get(selectedIdea.id) ?? null}
          unlinkedVideos={unlinkedVideos}
          tasks={tasks}
          taskTypes={taskTypes}
          taskTypesById={taskTypesById}
          statusColors={settings.statusColors}
          onTasksChanged={refresh}
          onClose={() => setSelectedIdea(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
          ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
          onTagsChanged={refresh}
          onSeriesChanged={refresh}
          onLinkVideo={handleLinkVideo}
          onUnlinkVideo={handleUnlinkVideo}
        />
      )}

      {editingObject && (
        <ObjectFormModal
          object={editingObject}
          onClose={() => setEditingObject(null)}
          onSave={handleUpdateObject}
          onDelete={handleDeleteObject}
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
          onSave={handleUpdateTask}
          onDelete={handleDeleteTask}
          onTaskTypesChanged={refresh}
          onOpenIdea={(idea) => {
            setEditingTask(null)
            setSelectedIdea(idea)
          }}
        />
      )}
    </div>
  )
}
