import { useMemo, useState, type ReactElement } from 'react'
import type { Series, VideoIdea } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { formatNumber, formatRelativeTime } from '../../lib/format'
import { computeSeriesStats } from '../../lib/seriesStats'
import { SeriesDetailModal } from './SeriesDetailModal'

interface SeriesListRowProps {
  series: Series
  episodeCount: number
  lastEpisodeDate: string | null
  avgViews: number | null
  onClick: () => void
}

function SeriesListRow({
  series,
  episodeCount,
  lastEpisodeDate,
  avgViews,
  onClick
}: SeriesListRowProps): ReactElement {
  return (
    <div
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 hover:bg-white/[0.04]"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5 text-3xl">
        {series.emoji || '🎬'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-gray-100">{series.name}</span>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-gray-400">
            {episodeCount} vidéo{episodeCount > 1 ? 's' : ''}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          Dernier épisode {formatRelativeTime(lastEpisodeDate)}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-medium text-gray-200">{formatNumber(avgViews)}</p>
        <p className="text-xs text-gray-500">vues moy.</p>
      </div>
    </div>
  )
}

export function SeriesTab(): ReactElement {
  const {
    ideas,
    objects,
    objectsById,
    tags,
    tagsById,
    series,
    publishedVideos,
    publishedVideosByIdeaId,
    tasks,
    taskTypes,
    taskTypesById,
    pendingTaskCountByIdeaId,
    settings,
    loading,
    refresh
  } = useIdeasData()
  const [newName, setNewName] = useState('')
  const [openSeriesId, setOpenSeriesId] = useState<number | null>(null)
  const openSeries = series.find((s) => s.id === openSeriesId) ?? null

  const ideasBySeriesId = useMemo(() => {
    const map = new Map<number, VideoIdea[]>()
    for (const idea of ideas) {
      if (idea.seriesId === null) continue
      const list = map.get(idea.seriesId) ?? []
      list.push(idea)
      map.set(idea.seriesId, list)
    }
    return map
  }, [ideas])

  async function handleCreate(): Promise<void> {
    const trimmed = newName.trim()
    if (!trimmed) return
    await window.api.series.create(trimmed)
    setNewName('')
    await refresh()
  }

  async function handleRename(s: Series, name: string): Promise<void> {
    await window.api.series.rename(s.id, name)
    await refresh()
  }

  async function handleEmojiChange(s: Series, emoji: string): Promise<void> {
    await window.api.series.updateEmoji(s.id, emoji)
    await refresh()
  }

  async function handleDelete(s: Series): Promise<void> {
    await window.api.series.remove(s.id)
    setOpenSeriesId(null)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Séries</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreate()
          }}
          className="mb-4 flex gap-2"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de la nouvelle série..."
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            + Nouvelle série
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : series.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune série pour l’instant.</p>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.03]">
            {series.map((s) => {
              const stats = computeSeriesStats(
                ideasBySeriesId.get(s.id) ?? [],
                publishedVideosByIdeaId
              )
              return (
                <SeriesListRow
                  key={s.id}
                  series={s}
                  episodeCount={stats.episodeCount}
                  lastEpisodeDate={stats.lastEpisodeDate}
                  avgViews={stats.avgViews}
                  onClick={() => setOpenSeriesId(s.id)}
                />
              )
            })}
          </div>
        )}
      </div>

      {openSeries && (
        <SeriesDetailModal
          series={openSeries}
          allIdeas={ideas}
          objects={objects}
          objectsById={objectsById}
          tags={tags}
          tagsById={tagsById}
          allSeries={series}
          publishedVideos={publishedVideos}
          publishedVideosByIdeaId={publishedVideosByIdeaId}
          statusColors={settings.statusColors}
          showTags={settings.showTagsOnIdeaCard}
          ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
          pendingTaskCountByIdeaId={pendingTaskCountByIdeaId}
          tasks={tasks}
          taskTypes={taskTypes}
          taskTypesById={taskTypesById}
          onClose={() => setOpenSeriesId(null)}
          onRename={(name) => handleRename(openSeries, name)}
          onEmojiChange={(emoji) => handleEmojiChange(openSeries, emoji)}
          onDeleteSeries={() => handleDelete(openSeries)}
          onSeriesChanged={refresh}
          refresh={refresh}
        />
      )}
    </div>
  )
}
