import type { ReactElement } from 'react'
import type { PublishedVideo, Tag } from '@shared/types'
import { formatNumber } from '../../lib/format'
import { getTagChipStyle } from '../../lib/tagColors'

interface VideosPreviewModalProps {
  title: string
  videos: PublishedVideo[]
  tagsById: Map<number, Tag>
  onClose: () => void
}

export function VideosPreviewModal({
  title,
  videos,
  tagsById,
  onClose
}: VideosPreviewModalProps): ReactElement {
  const sorted = [...videos].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-white/10 bg-[#15161a] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-5">
          <h2 className="text-lg font-semibold text-gray-100">
            {title} ({sorted.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-5">
          {sorted.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune vidéo.</p>
          ) : (
            sorted.map((video) => {
              const videoTags = video.tagIds
                .map((id) => tagsById.get(id))
                .filter((t): t is Tag => t !== undefined)
              return (
                <div
                  key={video.youtubeVideoId}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/5 text-lg">
                    {video.emoji || '🎥'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-200">{video.title}</p>
                    {videoTags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {videoTags.map((tag) => (
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
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatNumber(video.viewCount)} vues
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
