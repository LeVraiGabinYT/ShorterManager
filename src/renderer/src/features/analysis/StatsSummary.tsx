import type { ReactElement } from 'react'
import type { VideoStatsSummary } from '../../lib/videoStats'

interface StatsSummaryProps {
  stats: VideoStatsSummary
  title?: string
  accent?: string
}

function formatNumber(value: number | null): string {
  if (value === null) return '—'
  return Math.round(value).toLocaleString('fr-FR')
}

function Stat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <p className="text-xl font-semibold text-gray-100">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

export function StatsSummary({ stats, title, accent }: StatsSummaryProps): ReactElement {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      {title && (
        <h3 className={`mb-3 text-sm font-medium ${accent ?? 'text-gray-200'}`}>{title}</h3>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Vidéos" value={stats.count.toString()} />
        <Stat label="Vues moy." value={formatNumber(stats.avgViews)} />
        <Stat label="Likes moy." value={formatNumber(stats.avgLikes)} />
        <Stat label="Comm. moy." value={formatNumber(stats.avgComments)} />
      </div>

      {stats.avgRetention !== null && (
        <p className="mt-2 text-xs text-gray-500">
          ▶️ {stats.avgRetention.toFixed(0)}% de la vidéo regardée en moyenne
        </p>
      )}

      {stats.best && stats.worst && stats.best.id !== stats.worst.id && (
        <div className="mt-3 grid grid-cols-1 gap-1.5 border-t border-white/10 pt-3 text-xs sm:grid-cols-2">
          <p className="truncate text-emerald-300">
            🏆 Meilleure : {stats.best.title} ({formatNumber(stats.best.viewCount)} vues)
          </p>
          <p className="truncate text-red-300">
            📉 Moins bonne : {stats.worst.title} ({formatNumber(stats.worst.viewCount)} vues)
          </p>
        </div>
      )}
    </div>
  )
}
