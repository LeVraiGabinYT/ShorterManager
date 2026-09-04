import { useMemo, useState, type ReactElement } from 'react'
import type { PublishedVideo, Tag, VideoIdea } from '@shared/types'
import { formatDate } from '../../lib/format'

interface TimelinePanelProps {
  tags: Tag[]
  publishedVideos: PublishedVideo[]
  ideas: VideoIdea[]
}

interface TimelineEntry {
  key: string
  date: string | null
  kind: 'published' | 'production'
  title: string
  emoji: string | null
  viewCount: number | null
}

const PUBLISHED_COLOR = '#3987e5'
const PRODUCTION_COLOR = '#d95926'

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

function nextMonthKey(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  const next = new Date(year, month, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(monthStr: string): string {
  const [year, month] = monthStr.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', {
    month: 'short',
    year: '2-digit'
  })
}

export function TimelinePanel({ tags, publishedVideos, ideas }: TimelinePanelProps): ReactElement {
  const [tagId, setTagId] = useState<number | null>(null)

  const entries = useMemo<TimelineEntry[]>(() => {
    if (tagId === null) return []

    const linkedIdeaIds = new Set(
      publishedVideos.map((v) => v.ideaId).filter((id): id is number => id !== null)
    )

    const published: TimelineEntry[] = publishedVideos
      .filter((v) => v.tagIds.includes(tagId))
      .map((v) => ({
        key: `video-${v.youtubeVideoId}`,
        date: v.publishedAt,
        kind: 'published',
        title: v.title ?? v.youtubeVideoId,
        emoji: null,
        viewCount: v.viewCount
      }))

    const production: TimelineEntry[] = ideas
      .filter((idea) => idea.tagIds.includes(tagId) && !linkedIdeaIds.has(idea.id))
      .map((idea) => ({
        key: `idea-${idea.id}`,
        date: idea.publishDate ?? idea.shootDate,
        kind: 'production',
        title: idea.title,
        emoji: idea.emoji,
        viewCount: null
      }))

    return [...published, ...production].sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return b.date.localeCompare(a.date)
    })
  }, [tagId, publishedVideos, ideas])

  const buckets = useMemo(() => {
    const dated = entries.filter((e): e is TimelineEntry & { date: string } => e.date !== null)
    if (dated.length === 0) return []

    const months = dated.map((e) => monthKey(e.date))
    const minMonth = months.reduce((a, b) => (a < b ? a : b))
    const maxMonth = months.reduce((a, b) => (a > b ? a : b))

    const result: { month: string; published: number; production: number }[] = []
    let cursor = minMonth
    while (cursor <= maxMonth) {
      result.push({ month: cursor, published: 0, production: 0 })
      cursor = nextMonthKey(cursor)
    }

    for (const entry of dated) {
      const bucket = result.find((b) => b.month === monthKey(entry.date))
      if (!bucket) continue
      if (entry.kind === 'published') bucket.published += 1
      else bucket.production += 1
    }

    return result
  }, [entries])

  const maxTotal = Math.max(1, ...buckets.map((b) => b.published + b.production))
  const publishedCount = entries.filter((e) => e.kind === 'published').length
  const productionCount = entries.filter((e) => e.kind === 'production').length

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">
          Tag à analyser dans le temps
        </label>
        <select
          value={tagId ?? ''}
          onChange={(e) => setTagId(e.target.value ? Number(e.target.value) : null)}
          className="w-full max-w-sm rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
        >
          <option value="" className="bg-[#15161a]">
            Choisir un tag...
          </option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id} className="bg-[#15161a]">
              {tag.name}
            </option>
          ))}
        </select>
      </div>

      {tagId !== null && (
        <>
          <p className="text-sm text-gray-400">
            {publishedCount} vidéo{publishedCount !== 1 ? 's' : ''} publiée
            {publishedCount !== 1 ? 's' : ''} · {productionCount} en préparation
          </p>

          {buckets.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: PUBLISHED_COLOR }}
                  />
                  Publiée
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: PRODUCTION_COLOR }}
                  />
                  En préparation
                </span>
              </div>

              <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: 120 }}>
                {buckets.map((bucket) => {
                  const total = bucket.published + bucket.production
                  const totalHeight = (total / maxTotal) * 100
                  const publishedHeight = total > 0 ? (bucket.published / total) * totalHeight : 0
                  const productionHeight = total > 0 ? (bucket.production / total) * totalHeight : 0
                  return (
                    <div
                      key={bucket.month}
                      className="flex h-full w-4 shrink-0 flex-col justify-end"
                      title={`${monthLabel(bucket.month)} — ${bucket.published} publiée(s), ${bucket.production} en préparation`}
                    >
                      <div
                        style={{
                          height: `${productionHeight}%`,
                          backgroundColor: PRODUCTION_COLOR
                        }}
                        className="w-full rounded-t-sm"
                      />
                      <div
                        style={{
                          height: `${publishedHeight}%`,
                          backgroundColor: PUBLISHED_COLOR
                        }}
                        className={productionHeight === 0 ? 'w-full rounded-t-sm' : 'w-full'}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 flex gap-1 overflow-x-auto text-[10px] text-gray-600">
                {buckets.map((bucket) => (
                  <span key={bucket.month} className="w-4 shrink-0 text-center">
                    {buckets.length <= 24 ? monthLabel(bucket.month).slice(0, 3) : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {entries.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune vidéo ou idée avec ce tag.</p>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.key}
                  className={`flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm ${
                    entry.kind === 'published'
                      ? 'border-blue-500/20 bg-blue-500/5'
                      : 'border-orange-500/20 bg-orange-500/5'
                  }`}
                >
                  <span className="truncate text-gray-200">
                    {entry.emoji && <span className="mr-1.5">{entry.emoji}</span>}
                    {entry.title}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {entry.kind === 'published'
                      ? `Publiée le ${formatDate(entry.date)}${
                          entry.viewCount !== null
                            ? ` · ${entry.viewCount.toLocaleString('fr-FR')} vues`
                            : ''
                        }`
                      : `Prévue ${entry.date ? `le ${formatDate(entry.date)}` : '(date non définie)'}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
