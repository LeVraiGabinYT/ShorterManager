import type { ReactElement } from 'react'
import type { OwnedObject, Series, Tag, VideoIdea } from '@shared/types'
import { IDEA_STATUSES } from '@shared/types'
import { formatDate } from '../../lib/format'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { getTagChipStyle } from '../../lib/tagColors'
import { STATUS_ROW_BACKGROUND, STATUS_STYLES } from './statusStyles'

interface IdeaListRowProps {
  idea: VideoIdea
  objectsById: Map<number, OwnedObject>
  tagsById: Map<number, Tag>
  seriesById: Map<number, Series>
  selected?: boolean
  onToggleSelect?: () => void
  onClick: () => void
}

export function IdeaListRow({
  idea,
  objectsById,
  tagsById,
  seriesById,
  selected = false,
  onToggleSelect,
  onClick
}: IdeaListRowProps): ReactElement {
  const { status, missingObjects } = getEffectiveStatus(idea, objectsById)
  const statusLabel = IDEA_STATUSES.find((s) => s.value === status)?.label ?? status
  const objects = idea.objectIds.map((id) => objectsById.get(id)).filter(Boolean) as OwnedObject[]
  const tags = idea.tagIds.map((id) => tagsById.get(id)).filter(Boolean) as Tag[]
  const series = idea.seriesId !== null ? (seriesById.get(idea.seriesId) ?? null) : null
  const rowBackground = STATUS_ROW_BACKGROUND[status] || 'hover:bg-white/[0.04]'

  return (
    <div
      onClick={onClick}
      className={`flex w-full cursor-pointer items-stretch gap-3 border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 ${
        selected ? 'bg-blue-500/10' : rowBackground
      }`}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleSelect}
          className="mt-1 h-4 w-4 shrink-0 self-start rounded border-white/20 bg-white/5 accent-blue-600"
        />
      )}

      <span className="flex w-14 shrink-0 items-center justify-center self-stretch rounded-lg bg-white/5 text-3xl">
        {idea.emoji || '🎥'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="min-w-0 flex-1 truncate font-medium text-gray-100">{idea.title}</span>

          {series && (
            <span className="shrink-0 rounded-full border border-violet-500/40 bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-300">
              {series.name}
            </span>
          )}

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

          <span className="shrink-0 text-xs text-gray-400">🎬 {formatDate(idea.shootDate)}</span>
          <span className="shrink-0 text-xs text-gray-400">📅 {formatDate(idea.publishDate)}</span>
        </div>

        {(tags.length > 0 || objects.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={`tag-${tag.id}`}
                style={getTagChipStyle(tag.color)}
                className="rounded-md border px-2 py-0.5 text-xs font-medium"
              >
                {tag.name}
              </span>
            ))}
            {objects.map((obj) => (
              <span
                key={`obj-${obj.id}`}
                className={`rounded-md px-2 py-0.5 text-xs border ${
                  obj.purchased
                    ? 'bg-white/5 text-gray-300 border-white/10'
                    : 'bg-red-500/10 text-red-300 border-red-500/30'
                }`}
              >
                {obj.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
