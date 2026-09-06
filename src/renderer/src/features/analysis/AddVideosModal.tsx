import { useMemo, useState, type ReactElement } from 'react'
import type { OwnedObject, PublishedVideo, Series, Tag, VideoIdea } from '@shared/types'
import { DEFAULT_VIDEO_FILTERS, filterPublishedVideosByState } from '../../lib/videoFilters'
import { AnalysisVideoRow } from './AnalysisVideoRow'
import { VideoFiltersBar } from './VideoFiltersBar'

const GROUP_LABEL = { blue: 'Groupe Bleu', orange: 'Groupe Orange' } as const
const GROUP_COLOR = { blue: '#3987e5', orange: '#d95926' } as const

interface AddVideosModalProps {
  targetGroup: 'blue' | 'orange'
  availableVideos: PublishedVideo[]
  tags: Tag[]
  objects: OwnedObject[]
  series: Series[]
  tagsById: Map<number, Tag>
  ideasById: Map<number, VideoIdea>
  onAdd: (videoIds: string[]) => void
  onClose: () => void
}

export function AddVideosModal({
  targetGroup,
  availableVideos,
  tags,
  objects,
  series,
  tagsById,
  ideasById,
  onAdd,
  onClose
}: AddVideosModalProps): ReactElement {
  const [filters, setFilters] = useState(DEFAULT_VIDEO_FILTERS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(
    () => filterPublishedVideosByState(availableVideos, filters, ideasById, tagsById),
    [availableVideos, filters, ideasById, tagsById]
  )

  function toggle(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAddSelected(): void {
    if (selectedIds.size === 0) return
    onAdd([...selectedIds])
    onClose()
  }

  const color = GROUP_COLOR[targetGroup]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-white/10 bg-[#15161a] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            Ajouter des vidéos — {GROUP_LABEL[targetGroup]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <VideoFiltersBar
            filters={filters}
            onChange={setFilters}
            tags={tags}
            objects={objects}
            series={series}
          />

          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucune vidéo disponible{' '}
              {availableVideos.length === 0 ? '(tout est déjà dans ce groupe)' : 'pour ces filtres'}
              .
            </p>
          ) : (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 px-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={filtered.every((v) => selectedIds.has(v.youtubeVideoId))}
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked ? new Set(filtered.map((v) => v.youtubeVideoId)) : new Set()
                    )
                  }
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-600"
                />
                Tout sélectionner ({filtered.length})
              </label>
              {filtered.map((video) => (
                <AnalysisVideoRow
                  key={video.youtubeVideoId}
                  video={video}
                  tagsById={tagsById}
                  selected={selectedIds.has(video.youtubeVideoId)}
                  onToggle={() => toggle(video.youtubeVideoId)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleAddSelected}
            disabled={selectedIds.size === 0}
            style={selectedIds.size > 0 ? { backgroundColor: color } : undefined}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-500"
          >
            Ajouter {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
