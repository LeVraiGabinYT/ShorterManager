import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { PublishedVideo, Tag } from '@shared/types'
import { formatNumber } from '../../lib/format'
import { computeVideoStats } from '../../lib/videoStats'
import { biasCorrectedAvgViews, computeWordUsage, type WordUsage } from '../../lib/wordFrequency'
import { VideosPreviewModal } from './VideosPreviewModal'

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

interface Preview {
  title: string
  videos: PublishedVideo[]
}

const STORAGE_KEY = 'analysisTab.trendsSort'

interface StoredTrendsSort {
  tagSortBy: SortBy
  tagSortDir: SortDir
  wordSortBy: SortBy
  wordSortDir: SortDir
  excludeStopwords: boolean
  correctBias: boolean
}

const DEFAULT_TRENDS_SORT: StoredTrendsSort = {
  tagSortBy: 'count',
  tagSortDir: 'desc',
  wordSortBy: 'count',
  wordSortDir: 'desc',
  excludeStopwords: true,
  correctBias: true
}

// Remembers each side's sort choice (and the stop-word filter) across tab switches — a temporary
// preference, not app data, so it lives in the same local storage as the other Analyse settings.
function loadStoredTrendsSort(): StoredTrendsSort {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TRENDS_SORT
    const parsed = JSON.parse(raw) as Partial<StoredTrendsSort> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_TRENDS_SORT

    const isSortBy = (v: unknown): v is SortBy => v === 'count' || v === 'avgViews'
    const isSortDir = (v: unknown): v is SortDir => v === 'asc' || v === 'desc'

    return {
      tagSortBy: isSortBy(parsed.tagSortBy) ? parsed.tagSortBy : DEFAULT_TRENDS_SORT.tagSortBy,
      tagSortDir: isSortDir(parsed.tagSortDir) ? parsed.tagSortDir : DEFAULT_TRENDS_SORT.tagSortDir,
      wordSortBy: isSortBy(parsed.wordSortBy) ? parsed.wordSortBy : DEFAULT_TRENDS_SORT.wordSortBy,
      wordSortDir: isSortDir(parsed.wordSortDir)
        ? parsed.wordSortDir
        : DEFAULT_TRENDS_SORT.wordSortDir,
      excludeStopwords:
        typeof parsed.excludeStopwords === 'boolean'
          ? parsed.excludeStopwords
          : DEFAULT_TRENDS_SORT.excludeStopwords,
      correctBias:
        typeof parsed.correctBias === 'boolean'
          ? parsed.correctBias
          : DEFAULT_TRENDS_SORT.correctBias
    }
  } catch {
    return DEFAULT_TRENDS_SORT
  }
}

function SortControls({
  sortBy,
  sortDir,
  onSortByChange,
  onSortDirToggle
}: {
  sortBy: SortBy
  sortDir: SortDir
  onSortByChange: (sortBy: SortBy) => void
  onSortDirToggle: () => void
}): ReactElement {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-gray-500">
      <span>Trier par</span>
      <button
        type="button"
        onClick={() => onSortByChange('count')}
        className={sortBy === 'count' ? 'font-medium text-blue-300' : 'hover:text-gray-300'}
      >
        Occurrences
      </button>
      <span>/</span>
      <button
        type="button"
        onClick={() => onSortByChange('avgViews')}
        className={sortBy === 'avgViews' ? 'font-medium text-blue-300' : 'hover:text-gray-300'}
      >
        Vues moyennes
      </button>
      <button
        type="button"
        onClick={onSortDirToggle}
        className="ml-1 rounded-md border border-white/10 px-2 py-0.5 text-gray-300 hover:bg-white/5"
      >
        {sortDir === 'desc' ? '↓ Décroissant' : '↑ Croissant'}
      </button>
    </div>
  )
}

function TagUsageRow({
  tag,
  value,
  maxValue,
  detail,
  onClick,
  onShowVideos
}: {
  tag: Tag
  value: number
  maxValue: number
  detail: string
  onClick: () => void
  onShowVideos: () => void
}): ReactElement {
  return (
    <div
      onClick={onClick}
      title={`${tag.name} — ${detail}`}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5"
    >
      <span className="w-28 shrink-0 truncate text-xs text-gray-300 sm:w-36">{tag.name}</span>
      <div className="h-4 flex-1 rounded bg-white/5">
        <div
          className="h-full rounded"
          style={{ width: `${(value / maxValue) * 100}%`, backgroundColor: tag.color }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-xs text-gray-500">{detail}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onShowVideos()
        }}
        className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-white/5 hover:text-gray-200"
      >
        Voir les vidéos
      </button>
    </div>
  )
}

function WordUsageRow({
  word,
  value,
  maxValue,
  detail,
  onShowVideos
}: {
  word: string
  value: number
  maxValue: number
  detail: string
  onShowVideos: () => void
}): ReactElement {
  return (
    <div
      title={`${word} — ${detail}`}
      className="flex w-full items-center gap-2 rounded-md px-1 py-1"
    >
      <span className="w-24 shrink-0 truncate text-xs text-gray-300 sm:w-32">{word}</span>
      <div className="h-4 flex-1 rounded bg-white/5">
        <div
          className="h-full rounded bg-cyan-500"
          style={{ width: `${(value / maxValue) * 100}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-xs text-gray-500">{detail}</span>
      <button
        type="button"
        onClick={onShowVideos}
        className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-gray-400 hover:bg-white/5 hover:text-gray-200"
      >
        Voir les vidéos
      </button>
    </div>
  )
}

function TagsColumn({
  tags,
  tagsById,
  publishedVideos,
  sortBy,
  sortDir,
  onSortByChange,
  onSortDirToggle,
  onShowVideos
}: {
  tags: Tag[]
  tagsById: Map<number, Tag>
  publishedVideos: PublishedVideo[]
  sortBy: SortBy
  sortDir: SortDir
  onSortByChange: (sortBy: SortBy) => void
  onSortDirToggle: () => void
  onShowVideos: (preview: Preview) => void
}): ReactElement {
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])

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
  const selectedTagVideos = useMemo(
    () =>
      selectedTagId === null ? [] : publishedVideos.filter((v) => v.tagIds.includes(selectedTagId)),
    [selectedTagId, publishedVideos]
  )

  function showVideosForTag(tag: Tag): void {
    onShowVideos({
      title: `Vidéos taguées « ${tag.name} »`,
      videos: publishedVideos.filter((v) => v.tagIds.includes(tag.id))
    })
  }

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
      <div className="flex h-full min-h-0 flex-col gap-2">
        <h3 className="shrink-0 text-sm font-medium text-gray-200">Tags</h3>
        <p className="shrink-0 text-xs text-gray-500">
          Clique sur un tag pour voir avec quels autres tags il apparaît le plus souvent.
        </p>

        <SortControls
          sortBy={sortBy}
          sortDir={sortDir}
          onSortByChange={onSortByChange}
          onSortDirToggle={onSortDirToggle}
        />

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
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
              onShowVideos={() => showVideosForTag(tag)}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h3 className="shrink-0 text-sm font-medium text-gray-200">Tags</h3>

      <div className="flex shrink-0 items-center justify-between gap-2">
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

      <div className="flex shrink-0 flex-wrap items-center gap-2">
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
        <button
          type="button"
          onClick={() =>
            onShowVideos({
              title: `Vidéos taguées « ${selectedUsage.tag.name} »`,
              videos: selectedTagVideos
            })
          }
          className="rounded-md border border-white/10 px-2 py-0.5 text-xs text-gray-300 hover:bg-white/5"
        >
          Voir les vidéos
        </button>
      </div>

      {coOccurrence.length === 0 ? (
        <p className="text-sm text-gray-500">
          Ce tag n’a jamais été utilisé aux côtés d’un autre tag.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <p className="shrink-0 text-xs text-gray-500">Utilisé avec :</p>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {coOccurrence.map(({ tag, count }) => (
              <TagUsageRow
                key={tag.id}
                tag={tag}
                value={count}
                maxValue={coOccurrenceMax}
                detail={`${count} vidéo${count !== 1 ? 's' : ''}`}
                onClick={() => selectTag(tag.id)}
                onShowVideos={() => showVideosForTag(tag)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function WordsColumn({
  publishedVideos,
  sortBy,
  sortDir,
  excludeStopwords,
  correctBias,
  onSortByChange,
  onSortDirToggle,
  onToggleStopwords,
  onToggleBiasCorrection,
  onShowVideos
}: {
  publishedVideos: PublishedVideo[]
  sortBy: SortBy
  sortDir: SortDir
  excludeStopwords: boolean
  correctBias: boolean
  onSortByChange: (sortBy: SortBy) => void
  onSortDirToggle: () => void
  onToggleStopwords: (value: boolean) => void
  onToggleBiasCorrection: (value: boolean) => void
  onShowVideos: (preview: Preview) => void
}): ReactElement {
  const usage = useMemo<WordUsage[]>(
    () => computeWordUsage(publishedVideos, excludeStopwords),
    [publishedVideos, excludeStopwords]
  )

  const globalAvgViews = useMemo(
    () => computeVideoStats(publishedVideos).avgViews ?? 0,
    [publishedVideos]
  )

  const sortedUsage = useMemo(() => {
    // A word backed by a single video is unreliable evidence either way — its "average" is just
    // that one video's view count — so bias correction drops it entirely instead of merely
    // demoting it.
    const eligible = correctBias ? usage.filter((u) => u.count > 1) : usage
    const sign = sortDir === 'desc' ? -1 : 1
    function scoreFor(u: WordUsage): number {
      if (sortBy === 'count') return u.count
      return correctBias ? biasCorrectedAvgViews(u, globalAvgViews) : (u.avgViews ?? -1)
    }
    return [...eligible].sort((a, b) => sign * (scoreFor(a) - scoreFor(b)))
  }, [usage, sortBy, sortDir, correctBias, globalAvgViews])

  const maxCount = Math.max(1, ...usage.map((u) => u.count))
  const maxAvgViews = Math.max(1, ...usage.map((u) => u.avgViews ?? 0))

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <h3 className="shrink-0 text-sm font-medium text-gray-200">Mots-clés des titres</h3>
      <p className="shrink-0 text-xs text-gray-500">
        Les mots qui reviennent le plus souvent dans les titres de tes vidéos publiées.
      </p>

      <label className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
        <input
          type="checkbox"
          checked={excludeStopwords}
          onChange={(e) => onToggleStopwords(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-blue-600"
        />
        Filtrer les mots de liaison (je, et, à, le, la, les...)
      </label>

      <label
        className="flex shrink-0 items-center gap-2 text-xs text-gray-400"
        title="Masque les mots utilisés par une seule vidéo (moyenne peu fiable) et corrige le classement des autres pour qu'une vidéo virale isolée ne fausse pas tout."
      >
        <input
          type="checkbox"
          checked={correctBias}
          onChange={(e) => onToggleBiasCorrection(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-blue-600"
        />
        Correction du biais (vues moyennes)
      </label>

      <SortControls
        sortBy={sortBy}
        sortDir={sortDir}
        onSortByChange={onSortByChange}
        onSortDirToggle={onSortDirToggle}
      />

      {sortedUsage.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun mot exploitable pour l’instant.</p>
      ) : (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {sortedUsage.map(({ word, count, avgViews, videos }) => (
            <WordUsageRow
              key={word}
              word={word}
              value={sortBy === 'count' ? count : (avgViews ?? 0)}
              maxValue={sortBy === 'count' ? maxCount : maxAvgViews}
              detail={
                sortBy === 'count'
                  ? `${count} vidéo${count !== 1 ? 's' : ''}`
                  : `${formatNumber(avgViews)} vues moy.`
              }
              onShowVideos={() => onShowVideos({ title: `Vidéos contenant « ${word} »`, videos })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function TagTrendsPanel({
  tags,
  tagsById,
  publishedVideos
}: TagTrendsPanelProps): ReactElement {
  const [stored] = useState(loadStoredTrendsSort)
  const [tagSortBy, setTagSortBy] = useState(stored.tagSortBy)
  const [tagSortDir, setTagSortDir] = useState(stored.tagSortDir)
  const [wordSortBy, setWordSortBy] = useState(stored.wordSortBy)
  const [wordSortDir, setWordSortDir] = useState(stored.wordSortDir)
  const [excludeStopwords, setExcludeStopwords] = useState(stored.excludeStopwords)
  const [correctBias, setCorrectBias] = useState(stored.correctBias)
  const [preview, setPreview] = useState<Preview | null>(null)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tagSortBy,
        tagSortDir,
        wordSortBy,
        wordSortDir,
        excludeStopwords,
        correctBias
      })
    )
  }, [tagSortBy, tagSortDir, wordSortBy, wordSortDir, excludeStopwords, correctBias])

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="min-h-0 lg:border-r lg:border-white/10 lg:pr-4">
        <TagsColumn
          tags={tags}
          tagsById={tagsById}
          publishedVideos={publishedVideos}
          sortBy={tagSortBy}
          sortDir={tagSortDir}
          onSortByChange={setTagSortBy}
          onSortDirToggle={() => setTagSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
          onShowVideos={setPreview}
        />
      </div>

      <div className="min-h-0">
        <WordsColumn
          publishedVideos={publishedVideos}
          sortBy={wordSortBy}
          sortDir={wordSortDir}
          excludeStopwords={excludeStopwords}
          correctBias={correctBias}
          onSortByChange={setWordSortBy}
          onSortDirToggle={() => setWordSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
          onToggleStopwords={setExcludeStopwords}
          onToggleBiasCorrection={setCorrectBias}
          onShowVideos={setPreview}
        />
      </div>

      {preview && (
        <VideosPreviewModal
          title={preview.title}
          videos={preview.videos}
          tagsById={tagsById}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
