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
  onClick: () => void
}

export function IdeaCard({ idea, objectsById, tagsById, onClick }: IdeaCardProps): ReactElement {
  const { status, missingObjects } = getEffectiveStatus(idea, objectsById)
  const statusLabel = IDEA_STATUSES.find((s) => s.value === status)?.label ?? status
  const objects = idea.objectIds.map((id) => objectsById.get(id)).filter(Boolean) as OwnedObject[]
  const tags = idea.tagIds.map((id) => tagsById.get(id)).filter(Boolean) as Tag[]

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] hover:border-white/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-gray-100 leading-snug">
          {idea.emoji && <span className="mr-1.5">{idea.emoji}</span>}
          {idea.title}
        </h3>
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
    </button>
  )
}
