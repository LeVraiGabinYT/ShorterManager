import type { ReactElement } from 'react'
import type { PublishedVideo, Tag } from '@shared/types'
import { formatDate } from '../../lib/format'
import { getTagChipStyle } from '../../lib/tagColors'

interface AnalysisVideoRowProps {
  video: PublishedVideo
  tagsById: Map<number, Tag>
  selected: boolean
  onToggle: () => void
}

export function AnalysisVideoRow({
  video,
  tagsById,
  selected,
  onToggle
}: AnalysisVideoRowProps): ReactElement {
  const tags = video.tagIds.map((id) => tagsById.get(id)).filter(Boolean) as Tag[]

  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${
        selected
          ? 'border-blue-500/50 bg-blue-500/10'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-blue-600"
      />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/5 text-lg">
        {video.emoji || '🎥'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-200">{video.title}</p>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
          <span>📅 {formatDate(video.publishedAt)}</span>
          <span>👁️ {video.viewCount?.toLocaleString('fr-FR') ?? '—'}</span>
        </div>
      </div>
      {tags.length > 0 && (
        <div className="hidden flex-wrap gap-1 sm:flex">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              style={getTagChipStyle(tag.color)}
              className="rounded border px-1.5 py-0.5 text-[10px] font-medium"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </label>
  )
}
