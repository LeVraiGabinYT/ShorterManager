import { useMemo, type ReactElement } from 'react'
import { formatDate } from '../../lib/format'

export interface TimelineEntry {
  key: string
  date: string | null
  kind: 'published' | 'production'
  title: string
  emoji: string | null
  viewCount: number | null
}

interface EvolutionChartProps {
  entries: TimelineEntry[]
}

const BAR_COLOR = '#3987e5'
const BAR_WIDTH = 16
const BAR_GAP = 4
const LABEL_HEIGHT = 14
const BAR_AREA_HEIGHT = 120

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

export function EvolutionChart({ entries }: EvolutionChartProps): ReactElement {
  const currentMonth = monthKey(new Date().toISOString())

  const buckets = useMemo(() => {
    const dated = entries.filter((e): e is TimelineEntry & { date: string } => e.date !== null)
    if (dated.length === 0) return []

    const months = dated.map((e) => monthKey(e.date))
    const minMonth = months.reduce((a, b) => (a < b ? a : b))
    // Extend the range to "today" so the current-position marker always has a place to land,
    // even when every video so far lies in the past.
    const maxMonth = [...months, currentMonth].reduce((a, b) => (a > b ? a : b))

    const result: { month: string; count: number }[] = []
    let cursor = minMonth
    while (cursor <= maxMonth) {
      result.push({ month: cursor, count: 0 })
      cursor = nextMonthKey(cursor)
    }

    for (const entry of dated) {
      const bucket = result.find((b) => b.month === monthKey(entry.date))
      if (bucket) bucket.count += 1
    }

    return result
  }, [entries, currentMonth])

  const maxCount = Math.max(1, ...buckets.map((b) => b.count))
  const currentMonthIndex = buckets.findIndex((b) => b.month === currentMonth)

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Choisis un tag, un objet ou un mot-clé ci-dessous pour voir son évolution dans le temps.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {entries.length} vidéo{entries.length !== 1 ? 's' : ''} au total
      </p>

      {buckets.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div
            className="relative"
            style={{ width: buckets.length * (BAR_WIDTH + BAR_GAP) - BAR_GAP }}
          >
            {currentMonthIndex !== -1 && (
              <div
                className="pointer-events-none absolute top-0 border-l border-dashed border-amber-400/70"
                style={{
                  left: currentMonthIndex * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2,
                  height: LABEL_HEIGHT + BAR_AREA_HEIGHT
                }}
              >
                <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[9px] text-amber-400">
                  Aujourd’hui
                </span>
              </div>
            )}

            <div className="flex items-end gap-1">
              {buckets.map((bucket) => {
                const heightPct = (bucket.count / maxCount) * 100
                return (
                  <div
                    key={bucket.month}
                    className="flex shrink-0 flex-col items-center"
                    style={{ width: BAR_WIDTH }}
                    title={`${monthLabel(bucket.month)} — ${bucket.count} vidéo${bucket.count !== 1 ? 's' : ''}`}
                  >
                    <span
                      className="text-[9px] leading-[14px] text-gray-400"
                      style={{ height: LABEL_HEIGHT }}
                    >
                      {bucket.count}
                    </span>
                    <div
                      className="flex w-full flex-col justify-end"
                      style={{ height: BAR_AREA_HEIGHT }}
                    >
                      <div
                        style={{ height: `${heightPct}%`, backgroundColor: BAR_COLOR }}
                        className="w-full rounded-t-sm"
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-1 flex gap-1 text-[10px] text-gray-600">
              {buckets.map((bucket) => (
                <span
                  key={bucket.month}
                  className="shrink-0 text-center"
                  style={{ width: BAR_WIDTH }}
                >
                  {buckets.length <= 24 ? monthLabel(bucket.month).slice(0, 3) : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {entries.map((entry) => (
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
        ))}
      </div>
    </div>
  )
}
