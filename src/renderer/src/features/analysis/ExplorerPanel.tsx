import { useMemo, useState, type ReactElement } from 'react'
import type { AnalysisGroup, OwnedObject, PublishedVideo, Tag, VideoIdea } from '@shared/types'
import {
  DEFAULT_ANALYSIS_FILTERS,
  filterPublishedVideos,
  isAnalysisFiltersActive,
  type AnalysisFiltersState
} from '../../lib/analysisFilters'
import { computeVideoStats } from '../../lib/videoStats'
import { AddToGroupControl } from './AddToGroupControl'
import { AnalysisVideoRow } from './AnalysisVideoRow'
import { StatsSummary } from './StatsSummary'

interface ExplorerPanelProps {
  publishedVideos: PublishedVideo[]
  ideasById: Map<number, VideoIdea>
  tags: Tag[]
  tagsById: Map<number, Tag>
  objects: OwnedObject[]
  groups: AnalysisGroup[]
  onGroupsChanged: () => Promise<void>
}

export function ExplorerPanel({
  publishedVideos,
  ideasById,
  tags,
  tagsById,
  objects,
  groups,
  onGroupsChanged
}: ExplorerPanelProps): ReactElement {
  const [filters, setFilters] = useState<AnalysisFiltersState>(DEFAULT_ANALYSIS_FILTERS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(
    () => filterPublishedVideos(publishedVideos, filters, ideasById),
    [publishedVideos, filters, ideasById]
  )
  const stats = useMemo(() => computeVideoStats(filtered), [filtered])
  const active = isAnalysisFiltersActive(filters)

  function toggleTag(id: number): void {
    setFilters((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter((t) => t !== id) : [...f.tagIds, id]
    }))
  }

  function toggleObject(id: number): void {
    setFilters((f) => ({
      ...f,
      objectIds: f.objectIds.includes(id)
        ? f.objectIds.filter((o) => o !== id)
        : [...f.objectIds, id]
    }))
  }

  function toggleVideo(youtubeVideoId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(youtubeVideoId)) next.delete(youtubeVideoId)
      else next.add(youtubeVideoId)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
          placeholder="Mot-clé dans le titre..."
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
        />

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <label className="mb-1 block text-xs font-medium text-gray-400">Tags</label>
              {filters.tagIds.length > 1 && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, tagMode: 'any' }))}
                    className={filters.tagMode === 'any' ? 'text-blue-300' : ''}
                  >
                    Au moins un
                  </button>
                  <span>/</span>
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, tagMode: 'all' }))}
                    className={filters.tagMode === 'all' ? 'text-blue-300' : ''}
                  >
                    Tous (combinaison)
                  </button>
                </div>
              )}
            </div>
            {tags.length === 0 ? (
              <p className="text-xs text-gray-600">Aucun tag créé pour l’instant.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      filters.tagIds.includes(tag.id)
                        ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Objets</label>
            {objects.length === 0 ? (
              <p className="text-xs text-gray-600">Aucun objet enregistré pour l’instant.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {objects.map((obj) => (
                  <button
                    type="button"
                    key={obj.id}
                    onClick={() => toggleObject(obj.id)}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      filters.objectIds.includes(obj.id)
                        ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {obj.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {active && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_ANALYSIS_FILTERS)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-300"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      <StatsSummary
        stats={stats}
        title={active ? 'Moyennes pour cette combinaison de filtres' : 'Moyennes — toutes vidéos'}
      />

      {selectedIds.size > 0 && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
          <p className="mb-2 text-xs text-gray-400">
            {selectedIds.size} vidéo{selectedIds.size > 1 ? 's' : ''} sélectionnée
            {selectedIds.size > 1 ? 's' : ''}
          </p>
          <AddToGroupControl
            groups={groups}
            selectedVideoIds={[...selectedIds]}
            onAdded={async () => {
              setSelectedIds(new Set())
              await onGroupsChanged()
            }}
          />
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune vidéo ne correspond à ces filtres.</p>
        ) : (
          <>
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
                onToggle={() => toggleVideo(video.youtubeVideoId)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
