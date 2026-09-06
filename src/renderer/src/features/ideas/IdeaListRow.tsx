import type { ReactElement } from 'react'
import type { IdeaStatus, OwnedObject, Series, Tag, VideoIdea } from '@shared/types'
import { IDEA_STATUSES } from '@shared/types'
import { formatDate } from '../../lib/format'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { getTagChipStyle } from '../../lib/tagColors'
import { getStatusBadgeStyle, getStatusRowStyle } from './statusStyles'

interface IdeaListRowProps {
  idea: VideoIdea
  objectsById: Map<number, OwnedObject>
  seriesById: Map<number, Series>
  tagsById: Map<number, Tag>
  statusColors: Record<IdeaStatus, string>
  showTags?: boolean
  ruleMissingObjectsPreparation?: boolean
  pendingTaskCount?: number
  selected?: boolean
  onToggleSelect?: () => void
  onClick: () => void
  trailingAction?: ReactElement
}

export function IdeaListRow({
  idea,
  objectsById,
  seriesById,
  tagsById,
  statusColors,
  showTags = false,
  ruleMissingObjectsPreparation = true,
  pendingTaskCount = 0,
  selected = false,
  onToggleSelect,
  onClick,
  trailingAction
}: IdeaListRowProps): ReactElement {
  const { status, missingObjects } = getEffectiveStatus(
    idea,
    objectsById,
    ruleMissingObjectsPreparation
  )
  const statusLabel = IDEA_STATUSES.find((s) => s.value === status)?.label ?? status
  const series = idea.seriesId !== null ? (seriesById.get(idea.seriesId) ?? null) : null
  const ideaTags = showTags
    ? idea.tagIds.map((id) => tagsById.get(id)).filter((t): t is Tag => t !== undefined)
    : []

  return (
    <div
      onClick={onClick}
      style={selected ? undefined : getStatusRowStyle(statusColors[status])}
      className={`flex w-full cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-3 transition-[filter] last:border-b-0 hover:brightness-125 ${
        selected ? 'bg-blue-500/10' : ''
      }`}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleSelect}
          className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-blue-600"
        />
      )}

      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5 text-3xl">
        {idea.emoji || '🎥'}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 truncate font-medium text-gray-100">{idea.title}</span>

            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium"
              style={getStatusBadgeStyle(statusColors[status])}
            >
              {statusLabel}
            </span>

            {missingObjects && (
              <span className="shrink-0 rounded-full border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
                Objets manquants
              </span>
            )}

            {pendingTaskCount > 0 && (
              <span className="shrink-0 rounded-full border border-pink-500/40 bg-pink-500/20 px-2 py-0.5 text-xs font-medium text-pink-300">
                {pendingTaskCount} tâche{pendingTaskCount > 1 ? 's' : ''} en attente
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {series && (
              <span className="shrink-0 rounded-full border border-violet-500/40 bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-300">
                {series.name}
              </span>
            )}

            <span className="shrink-0 text-xs text-gray-400">🎬 {formatDate(idea.shootDate)}</span>
            <span className="shrink-0 text-xs text-gray-400">
              📅 {formatDate(idea.publishDate)}
            </span>
          </div>
        </div>

        {showTags && ideaTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ideaTags.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
                style={getTagChipStyle(tag.color)}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {trailingAction && (
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          {trailingAction}
        </div>
      )}
    </div>
  )
}
