import type { ReactElement } from 'react'
import type { PublishedVideo, Tag, VideoIdea } from '@shared/types'
import { formatDate } from '../../lib/format'
import { getTagChipStyle } from '../../lib/tagColors'

interface ChannelVideoRowProps {
  video: PublishedVideo
  linkedIdea: VideoIdea | null
  tagsById: Map<number, Tag>
  onClick: () => void
}

export function ChannelVideoRow({
  video,
  linkedIdea,
  tagsById,
  onClick
}: ChannelVideoRowProps): ReactElement {
  const tags = video.tagIds.map((id) => tagsById.get(id)).filter(Boolean) as Tag[]

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        linkedIdea
          ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white/5 text-3xl">
        {video.emoji || '🎥'}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-100">{video.title}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
          <span>📅 {formatDate(video.publishedAt)}</span>
          <span>👁️ {video.viewCount ?? '—'}</span>
          <span>👍 {video.likeCount ?? '—'}</span>
          <span>💬 {video.commentCount ?? '—'}</span>
          {video.averageViewPercentage !== null && (
            <span>▶️ {video.averageViewPercentage.toFixed(0)}% regardé</span>
          )}
        </div>
        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((tag) => (
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
      </div>

      {linkedIdea && (
        <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
          Liée
        </span>
      )}
    </button>
  )
}
