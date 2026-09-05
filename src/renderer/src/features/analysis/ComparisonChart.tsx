import type { ReactElement } from 'react'
import type { VideoStatsSummary } from '../../lib/videoStats'

const COLOR_A = '#3987e5'
const COLOR_B = '#d95926'

interface ComparisonChartProps {
  labelA: string
  labelB: string
  statsA: VideoStatsSummary
  statsB: VideoStatsSummary
}

function BarRow({
  label,
  valueA,
  valueB,
  format
}: {
  label: string
  valueA: number | null
  valueB: number | null
  format: (n: number) => string
}): ReactElement {
  const max = Math.max(valueA ?? 0, valueB ?? 0, 1)
  return (
    <div>
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <div className="space-y-1">
        {[
          { value: valueA, color: COLOR_A },
          { value: valueB, color: COLOR_B }
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 flex-1 rounded bg-white/5">
              <div
                className="h-full rounded"
                style={{ width: `${((row.value ?? 0) / max) * 100}%`, backgroundColor: row.color }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-gray-400">
              {row.value !== null ? format(row.value) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ComparisonChart({
  labelA,
  labelB,
  statsA,
  statsB
}: ComparisonChartProps): ReactElement {
  const round = (n: number): string => Math.round(n).toLocaleString('fr-FR')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: COLOR_A }}
          />
          {labelA} ({statsA.count})
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: COLOR_B }}
          />
          {labelB} ({statsB.count})
        </span>
      </div>

      <BarRow label="Vues moy." valueA={statsA.avgViews} valueB={statsB.avgViews} format={round} />
      <BarRow label="Likes moy." valueA={statsA.avgLikes} valueB={statsB.avgLikes} format={round} />
      <BarRow
        label="Commentaires moy."
        valueA={statsA.avgComments}
        valueB={statsB.avgComments}
        format={round}
      />
      {(statsA.avgRetention !== null || statsB.avgRetention !== null) && (
        <BarRow
          label="Rétention moy. (%)"
          valueA={statsA.avgRetention}
          valueB={statsB.avgRetention}
          format={(n) => `${n.toFixed(0)}%`}
        />
      )}
    </div>
  )
}
