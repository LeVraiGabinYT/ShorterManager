import type { ReactElement } from 'react'
import type { OwnedObject, Tag, VideoIdea } from '@shared/types'
import { IDEA_STATUSES } from '@shared/types'
import { formatDate } from '../../lib/format'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { getTagChipStyle } from '../../lib/tagColors'
import { STATUS_STYLES } from './statusStyles'

interface IdeaCardProps {
  idea: VideoIdea
  objectsById: Map<number, OwnedObject>
  tagsById: Map<number, Tag>
  selected: boolean
  onToggleSelect: () => void
  onClick: () => void
}

export function IdeaCard({
  idea,
  objectsById,
  tagsById,
  selected,
  onToggleSelect,
  onClick
}: IdeaCardProps): ReactElement {
  const { status, missingObjects } = getEffectiveStatus(idea, objectsById)
  const statusLabel = IDEA_STATUSES.find((s) => s.value === status)?.label ?? status
  const objects = idea.objectIds.map((id) => objectsById.get(id)).filter(Boolean) as OwnedObject[]
  const tags = idea.tagIds.map((id) => tagsById.get(id)).filter(Boolean) as Tag[]

  return (
    <div
      onClick={onClick}
      className={`w-full cursor-pointer rounded-lg border p-4 transition-colors ${
        selected
          ? 'border-blue-500/50 bg-blue-500/10'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={onToggleSelect}
            className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-blue-600"
          />
          <h3 className="min-w-0 font-medium text-gray-100 leading-snug">
            {idea.emoji && <span className="mr-1.5">{idea.emoji}</span>}
            {idea.title}
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
          >
            {statusLabel}
          </span>
          {missingObjects && (
            <span className="rounded-full border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-300">
              Objets manquants
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>🎬 Tournage : {formatDate(idea.shootDate)}</span>
        <span>📅 Publication : {formatDate(idea.publishDate)}</span>
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              style={getTagChipStyle(tag.color)}
              className="rounded-md border px-2 py-0.5 text-xs font-medium"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {objects.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {objects.map((obj) => (
            <span
              key={obj.id}
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
  )
}
