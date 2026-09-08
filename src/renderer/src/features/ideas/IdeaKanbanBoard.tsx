import { useState, type ReactElement } from 'react'
import { IDEA_STATUSES } from '@shared/types'
import type { IdeaStatus, OwnedObject, Series, Tag, VideoIdea } from '@shared/types'
import { CountdownBadge } from '../../components/CountdownBadge'
import { formatDate } from '../../lib/format'
import { getEffectiveStatus } from '../../lib/ideaStatus'

// "Publiée" is deliberately not a column here — it's a "done" bucket that would only ever grow,
// turning the board into an endless scroll instead of a working view of the active pipeline.
// Published ideas stay fully visible and searchable in the List view.
const KANBAN_STATUSES = IDEA_STATUSES.filter((s) => s.value !== 'published')

interface IdeaKanbanBoardProps {
  ideas: VideoIdea[]
  objectsById: Map<number, OwnedObject>
  seriesById: Map<number, Series>
  tagsById: Map<number, Tag>
  statusColors: Record<IdeaStatus, string>
  ruleMissingObjectsPreparation: boolean
  pendingTaskCountByIdeaId: Map<number, number>
  onSelect: (idea: VideoIdea) => void
  onMove: (idea: VideoIdea, status: IdeaStatus) => void
}

interface KanbanCardProps {
  idea: VideoIdea
  seriesById: Map<number, Series>
  tagsById: Map<number, Tag>
  statusColor: string
  missingObjects: boolean
  pendingTaskCount: number
  dragged: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onClick: () => void
}

function KanbanCard({
  idea,
  seriesById,
  tagsById,
  statusColor,
  missingObjects,
  pendingTaskCount,
  dragged,
  onDragStart,
  onDragEnd,
  onClick
}: KanbanCardProps): ReactElement {
  const series = idea.seriesId !== null ? (seriesById.get(idea.seriesId) ?? null) : null
  const tagCount = idea.tagIds.filter((id) => tagsById.has(id)).length

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{ borderColor: `${statusColor}55`, backgroundColor: `${statusColor}14` }}
      className={`cursor-grab space-y-1.5 rounded-lg border p-2.5 text-xs transition-opacity active:cursor-grabbing ${
        dragged ? 'opacity-40' : 'hover:brightness-125'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <span className="shrink-0 text-base leading-none">{idea.emoji || '🎥'}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-gray-100">{idea.title}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-400">
        {series && (
          <span className="rounded-full border border-violet-500/40 bg-violet-500/20 px-1.5 py-0.5 font-medium text-violet-300">
            {series.name}
          </span>
        )}
        {missingObjects && (
          <span className="rounded-full border border-red-500/40 bg-red-500/20 px-1.5 py-0.5 font-medium text-red-300">
            Objets manquants
          </span>
        )}
        {pendingTaskCount > 0 && (
          <span className="rounded-full border border-pink-500/40 bg-pink-500/20 px-1.5 py-0.5 font-medium text-pink-300">
            {pendingTaskCount} tâche{pendingTaskCount > 1 ? 's' : ''}
          </span>
        )}
        {tagCount > 0 && <span>🏷️ {tagCount}</span>}
      </div>

      {(idea.shootDate || idea.publishDate) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {idea.shootDate && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              🎬 {formatDate(idea.shootDate)}
              <CountdownBadge date={idea.shootDate} />
            </span>
          )}
          {idea.publishDate && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              📅 {formatDate(idea.publishDate)}
              <CountdownBadge date={idea.publishDate} />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export function IdeaKanbanBoard({
  ideas,
  objectsById,
  seriesById,
  tagsById,
  statusColors,
  ruleMissingObjectsPreparation,
  pendingTaskCountByIdeaId,
  onSelect,
  onMove
}: IdeaKanbanBoardProps): ReactElement {
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<IdeaStatus | null>(null)

  const effectiveById = new Map(
    ideas.map((idea) => [
      idea.id,
      getEffectiveStatus(idea, objectsById, ruleMissingObjectsPreparation)
    ])
  )

  function handleDrop(status: IdeaStatus): void {
    setDragOverStatus(null)
    const idea = ideas.find((i) => i.id === draggedId)
    setDraggedId(null)
    if (!idea) return
    const effective = effectiveById.get(idea.id)
    if (effective?.status === status) return
    onMove(idea, status)
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-2">
      {KANBAN_STATUSES.map((column) => {
        const columnIdeas = ideas.filter(
          (idea) => effectiveById.get(idea.id)?.status === column.value
        )
        const color = statusColors[column.value]
        return (
          <div
            key={column.value}
            onDragOver={(e) => {
              e.preventDefault()
              if (dragOverStatus !== column.value) setDragOverStatus(column.value)
            }}
            onDragLeave={() => setDragOverStatus((prev) => (prev === column.value ? null : prev))}
            onDrop={() => handleDrop(column.value)}
            style={{ borderColor: `${color}40` }}
            className={`flex w-64 shrink-0 flex-col rounded-lg border bg-white/[0.02] transition-colors ${
              dragOverStatus === column.value ? 'bg-white/[0.06]' : ''
            }`}
          >
            <div
              style={{ borderColor: `${color}40` }}
              className="flex items-center justify-between border-b px-3 py-2"
            >
              <span className="text-sm font-medium" style={{ color }}>
                {column.label}
              </span>
              <span className="text-xs text-gray-500">{columnIdeas.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {columnIdeas.map((idea) => {
                const effective = effectiveById.get(idea.id)
                return (
                  <KanbanCard
                    key={idea.id}
                    idea={idea}
                    seriesById={seriesById}
                    tagsById={tagsById}
                    statusColor={color}
                    missingObjects={effective?.missingObjects ?? false}
                    pendingTaskCount={pendingTaskCountByIdeaId.get(idea.id) ?? 0}
                    dragged={draggedId === idea.id}
                    onDragStart={() => setDraggedId(idea.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => onSelect(idea)}
                  />
                )
              })}
              {columnIdeas.length === 0 && (
                <p className="px-1 py-2 text-center text-xs text-gray-600">Vide</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
