import { useMemo, useState, type ReactElement } from 'react'
import type { PublishedVideo, Tag } from '@shared/types'
import { formatNumber } from '../../lib/format'
import { computeVideoStats } from '../../lib/videoStats'

interface TagUsage {
  tag: Tag
  count: number
  avgViews: number | null
}

type SortBy = 'count' | 'avgViews'
type SortDir = 'asc' | 'desc'

interface TagTrendsPanelProps {
  tags: Tag[]
  tagsById: Map<number, Tag>
  publishedVideos: PublishedVideo[]
}

function TagUsageRow({
  tag,
  value,
  maxValue,
  detail,
  onClick
}: {
  tag: Tag
  value: number
  maxValue: number
  detail: string
  onClick: () => void
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${tag.name} — ${detail}`}
      className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-white/5"
    >
      <span className="w-32 shrink-0 truncate text-xs text-gray-300 sm:w-44">{tag.name}</span>
      <div className="h-4 flex-1 rounded bg-white/5">
        <div
          className="h-full rounded"
          style={{ width: `${(value / maxValue) * 100}%`, backgroundColor: tag.color }}
        />
      </div>
      <span className="w-24 shrink-0 text-right text-xs text-gray-500">{detail}</span>
    </button>
  )
}

export function TagTrendsPanel({
  tags,
  tagsById,
  publishedVideos
}: TagTrendsPanelProps): ReactElement {
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [sortBy, setSortBy] = useState<SortBy>('count')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const usage = useMemo<TagUsage[]>(() => {
    const videosByTag = new Map<number, PublishedVideo[]>()
    for (const tag of tags) videosByTag.set(tag.id, [])
    for (const video of publishedVideos) {
      for (const tagId of video.tagIds) videosByTag.get(tagId)?.push(video)
    }
    return tags.map((tag) => {
      const videos = videosByTag.get(tag.id) ?? []
      return { tag, count: videos.length, avgViews: computeVideoStats(videos).avgViews }
    })
  }, [tags, publishedVideos])

  const sortedUsage = useMemo(() => {
    const sign = sortDir === 'desc' ? -1 : 1
    return [...usage].sort((a, b) => {
      const av = sortBy === 'count' ? a.count : (a.avgViews ?? -1)
      const bv = sortBy === 'count' ? b.count : (b.avgViews ?? -1)
      return sign * (av - bv)
    })
  }, [usage, sortBy, sortDir])

  const maxCount = Math.max(1, ...usage.map((u) => u.count))
  const maxAvgViews = Math.max(1, ...usage.map((u) => u.avgViews ?? 0))
  const selectedUsage = usage.find((u) => u.tag.id === selectedTagId) ?? null

  const coOccurrence = useMemo<TagUsage[]>(() => {
    if (selectedTagId === null) return []
    const videosByOther = new Map<number, PublishedVideo[]>()
    for (const video of publishedVideos) {
      if (!video.tagIds.includes(selectedTagId)) continue
      for (const otherId of video.tagIds) {
        if (otherId === selectedTagId) continue
        const list = videosByOther.get(otherId)
        if (list) list.push(video)
        else videosByOther.set(otherId, [video])
      }
    }
    return [...videosByOther.entries()]
      .map(([tagId, videos]) => {
        const tag = tagsById.get(tagId)
        return tag
          ? { tag, count: videos.length, avgViews: computeVideoStats(videos).avgViews }
          : null
      })
      .filter((entry): entry is TagUsage => entry !== null)
      .sort((a, b) => b.count - a.count)
  }, [selectedTagId, publishedVideos, tagsById])

  const coOccurrenceMax = Math.max(1, ...coOccurrence.map((u) => u.count))

  function selectTag(tagId: number): void {
    if (selectedTagId !== null && selectedTagId !== tagId) {
      setHistory((prev) => [...prev, selectedTagId])
    }
    setSelectedTagId(tagId)
  }

  function goBack(): void {
    if (history.length === 0) {
      setSelectedTagId(null)
      return
    }
    const next = [...history]
    const last = next.pop() as number
    setHistory(next)
    setSelectedTagId(last)
  }

  function resetToOverview(): void {
    setSelectedTagId(null)
    setHistory([])
  }

  if (tags.length === 0) {
    return <p className="text-sm text-gray-500">Aucun tag créé pour l’instant.</p>
  }

  if (selectedTagId === null || selectedUsage === null) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">
          Clique sur un tag pour voir avec quels autres tags il apparaît le plus souvent.
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>Trier par</span>
          <button
            type="button"
            onClick={() => setSortBy('count')}
            className={sortBy === 'count' ? 'font-medium text-blue-300' : 'hover:text-gray-300'}
          >
            Occurrences
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => setSortBy('avgViews')}
            className={sortBy === 'avgViews' ? 'font-medium text-blue-300' : 'hover:text-gray-300'}
          >
            Vues moyennes
          </button>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            className="ml-1 rounded-md border border-white/10 px-2 py-0.5 text-gray-300 hover:bg-white/5"
          >
            {sortDir === 'desc' ? '↓ Décroissant' : '↑ Croissant'}
          </button>
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {sortedUsage.map(({ tag, count, avgViews }) => (
            <TagUsageRow
              key={tag.id}
              tag={tag}
              value={sortBy === 'count' ? count : (avgViews ?? 0)}
              maxValue={sortBy === 'count' ? maxCount : maxAvgViews}
              detail={
                sortBy === 'count'
                  ? `${count} vidéo${count !== 1 ? 's' : ''}`
                  : `${formatNumber(avgViews)} vues moy.`
              }
              onClick={() => selectTag(tag.id)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <button type="button" onClick={goBack} className="text-gray-400 hover:text-gray-200">
            ← Retour
          </button>
          {history.length > 0 && (
            <button
              type="button"
              onClick={resetToOverview}
              className="text-gray-500 hover:text-gray-300"
            >
              (Vue d’ensemble)
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="rounded-full border px-2.5 py-1 text-sm font-medium"
          style={{
            backgroundColor: `${selectedUsage.tag.color}26`,
            borderColor: `${selectedUsage.tag.color}66`,
            color: selectedUsage.tag.color
          }}
        >
          {selectedUsage.tag.name}
        </span>
        <span className="text-xs text-gray-500">
          {selectedUsage.count} vidéo{selectedUsage.count !== 1 ? 's' : ''} ·{' '}
          {formatNumber(selectedUsage.avgViews)} vues moy.
        </span>
      </div>

      {coOccurrence.length === 0 ? (
        <p className="text-sm text-gray-500">
          Ce tag n’a jamais été utilisé aux côtés d’un autre tag.
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Utilisé avec :</p>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {coOccurrence.map(({ tag, count }) => (
              <TagUsageRow
                key={tag.id}
                tag={tag}
                value={count}
                maxValue={coOccurrenceMax}
                detail={`${count} vidéo${count !== 1 ? 's' : ''}`}
                onClick={() => selectTag(tag.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
