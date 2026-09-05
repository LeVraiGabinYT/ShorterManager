import type { ReactElement } from 'react'
import type { OwnedObject, Series, VideoIdea } from '@shared/types'
import { IDEA_STATUSES } from '@shared/types'
import { formatDate } from '../../lib/format'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { STATUS_ROW_BACKGROUND, STATUS_STYLES } from './statusStyles'

interface IdeaListRowProps {
  idea: VideoIdea
  objectsById: Map<number, OwnedObject>
  seriesById: Map<number, Series>
  ruleMissingObjectsPreparation?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  onClick: () => void
}

export function IdeaListRow({
  idea,
  objectsById,
  seriesById,
  ruleMissingObjectsPreparation = true,
  selected = false,
  onToggleSelect,
  onClick
}: IdeaListRowProps): ReactElement {
  const { status, missingObjects } = getEffectiveStatus(
    idea,
    objectsById,
    ruleMissingObjectsPreparation
  )
  const statusLabel = IDEA_STATUSES.find((s) => s.value === status)?.label ?? status
  const series = idea.seriesId !== null ? (seriesById.get(idea.seriesId) ?? null) : null
  const rowBackground = STATUS_ROW_BACKGROUND[status] || 'hover:bg-white/[0.04]'

  return (
    <div
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 ${
        selected ? 'bg-blue-500/10' : rowBackground
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

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 truncate font-medium text-gray-100">{idea.title}</span>

          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
          >
            {statusLabel}
          </span>

          {missingObjects && (
            <span className="shrink-0 rounded-full border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
              Objets manquants
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
          <span className="shrink-0 text-xs text-gray-400">📅 {formatDate(idea.publishDate)}</span>
        </div>
      </div>
    </div>
  )
}
