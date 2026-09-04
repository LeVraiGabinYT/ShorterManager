import type { ReactElement } from 'react'
import type { OwnedObject, VideoIdea } from '@shared/types'
import { IDEA_STATUSES } from '@shared/types'
import { formatDate } from '../../lib/format'
import { STATUS_STYLES } from './statusStyles'

interface IdeaCardProps {
  idea: VideoIdea
  objectsById: Map<number, OwnedObject>
  onClick: () => void
}

export function IdeaCard({ idea, objectsById, onClick }: IdeaCardProps): ReactElement {
  const statusLabel = IDEA_STATUSES.find((s) => s.value === idea.status)?.label ?? idea.status
  const objects = idea.objectIds.map((id) => objectsById.get(id)).filter(Boolean) as OwnedObject[]

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] hover:border-white/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-gray-100 leading-snug">{idea.title}</h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[idea.status]}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>🎬 Tournage : {formatDate(idea.shootDate)}</span>
        <span>📅 Publication : {formatDate(idea.publishDate)}</span>
      </div>

      {objects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {objects.map((obj) => (
            <span
              key={obj.id}
              className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-gray-300 border border-white/10"
            >
              {obj.name}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
