import { useMemo, type ReactElement } from 'react'
import type { PublishedVideo } from '@shared/types'
import { monthKey, monthLabel, nextMonthKey, todayMonthKey } from '../../lib/months'

const BLUE = '#3987e5'
const ORANGE = '#d95926'
const BAR_WIDTH = 9
const BAR_GAP = 3
const GROUP_GAP = 8
const CELL_WIDTH = BAR_WIDTH * 2 + BAR_GAP + GROUP_GAP
const LABEL_HEIGHT = 14
const BAR_AREA_HEIGHT = 110
const MONTH_LABEL_HEIGHT = 16
const CHART_HEIGHT = LABEL_HEIGHT + BAR_AREA_HEIGHT

interface GroupEvolutionChartProps {
  blueVideos: PublishedVideo[]
  orangeVideos: PublishedVideo[]
}

interface Bucket {
  month: string
  blue: number
  orange: number
}

function Bar({ count, max, color }: { count: number; max: number; color: string }): ReactElement {
  const heightPct = (count / max) * 100
  return (
    <div className="flex flex-col items-center" style={{ width: BAR_WIDTH }}>
      <span
        className="text-[8px] font-medium leading-[14px] text-gray-300"
        style={{ height: LABEL_HEIGHT }}
      >
        {count}
      </span>
      <div className="flex w-full flex-col justify-end" style={{ height: BAR_AREA_HEIGHT }}>
        <div
          style={{ height: `${heightPct}%`, backgroundColor: color }}
          className="w-full rounded-t-sm"
        />
      </div>
    </div>
  )
}

export function GroupEvolutionChart({
  blueVideos,
  orangeVideos
}: GroupEvolutionChartProps): ReactElement {
  const today = todayMonthKey()

  const buckets = useMemo<Bucket[]>(() => {
    const blueDated = blueVideos.filter((v) => v.publishedAt !== null)
    const orangeDated = orangeVideos.filter((v) => v.publishedAt !== null)
    const allMonths = [
      ...blueDated.map((v) => monthKey(v.publishedAt as string)),
      ...orangeDated.map((v) => monthKey(v.publishedAt as string))
    ]
    if (allMonths.length === 0) return []

    const minMonth = allMonths.reduce((a, b) => (a < b ? a : b))
    const maxMonth = [...allMonths, today].reduce((a, b) => (a > b ? a : b))

    const result: Bucket[] = []
    let cursor = minMonth
    while (cursor <= maxMonth) {
      result.push({ month: cursor, blue: 0, orange: 0 })
      cursor = nextMonthKey(cursor)
    }

    for (const video of blueDated) {
      const bucket = result.find((b) => b.month === monthKey(video.publishedAt as string))
      if (bucket) bucket.blue += 1
    }
    for (const video of orangeDated) {
      const bucket = result.find((b) => b.month === monthKey(video.publishedAt as string))
      if (bucket) bucket.orange += 1
    }

    return result
  }, [blueVideos, orangeVideos, today])

  const maxCount = Math.max(1, ...buckets.map((b) => Math.max(b.blue, b.orange)))
  const currentMonthIndex = buckets.findIndex((b) => b.month === today)

  if (blueVideos.length === 0 && orangeVideos.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Ajoute des vidéos aux groupes ci-dessous pour voir leur fréquence de publication dans le
        temps.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BLUE }} />
          Groupe Bleu ({blueVideos.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: ORANGE }}
          />
          Groupe Orange ({orangeVideos.length})
        </span>
      </div>

      {buckets.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div className="relative" style={{ width: buckets.length * CELL_WIDTH }}>
            {/* Alternating month bands — a visual ruler so it's obvious where one month ends and
                the next begins, especially with many months side by side. */}
            <div
              className="absolute left-0 top-0 flex"
              style={{ height: CHART_HEIGHT + MONTH_LABEL_HEIGHT }}
            >
              {buckets.map((bucket, i) => (
                <div
                  key={bucket.month}
                  style={{ width: CELL_WIDTH }}
                  className={`h-full ${i % 2 === 1 ? 'bg-white/[0.05]' : ''}`}
                />
              ))}
            </div>

            {currentMonthIndex !== -1 && (
              <div
                className="pointer-events-none absolute top-0 border-l border-dashed border-amber-400/70"
                style={{
                  left: currentMonthIndex * CELL_WIDTH + CELL_WIDTH / 2,
                  height: CHART_HEIGHT
                }}
              >
                <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[9px] text-amber-400">
                  Aujourd’hui
                </span>
              </div>
            )}

            <div className="relative flex items-end" style={{ height: CHART_HEIGHT }}>
              {buckets.map((bucket) => (
                <div
                  key={bucket.month}
                  className="flex shrink-0 items-end justify-center"
                  style={{ width: CELL_WIDTH, gap: BAR_GAP }}
                  title={`${monthLabel(bucket.month)} — ${bucket.blue} bleu(s), ${bucket.orange} orange(s)`}
                >
                  <Bar count={bucket.blue} max={maxCount} color={BLUE} />
                  <Bar count={bucket.orange} max={maxCount} color={ORANGE} />
                </div>
              ))}
            </div>

            <div className="relative flex" style={{ height: MONTH_LABEL_HEIGHT }}>
              {buckets.map((bucket) => (
                <span
                  key={bucket.month}
                  className="shrink-0 pt-1 text-center text-[9px] font-medium text-gray-400"
                  style={{ width: CELL_WIDTH }}
                >
                  {monthLabel(bucket.month).slice(0, 3)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
