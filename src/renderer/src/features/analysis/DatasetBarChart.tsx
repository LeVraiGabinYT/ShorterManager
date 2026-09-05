import type { ReactElement } from 'react'
import type { PublishedVideo } from '@shared/types'

const BAR_COLOR = '#3987e5'

interface DatasetBarChartProps {
  videos: PublishedVideo[]
}

export function DatasetBarChart({ videos }: DatasetBarChartProps): ReactElement {
  const withViews = videos.filter(
    (v): v is PublishedVideo & { viewCount: number } => typeof v.viewCount === 'number'
  )

  if (withViews.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Ajoute des vidéos ci-dessous pour voir apparaître le graphique.
      </p>
    )
  }

  const sorted = [...withViews].sort((a, b) => b.viewCount - a.viewCount)
  const max = sorted[0].viewCount || 1

  return (
    <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
      {sorted.map((video) => (
        <div
          key={video.youtubeVideoId}
          className="flex items-center gap-2"
          title={`${video.title ?? video.youtubeVideoId} — ${video.viewCount.toLocaleString('fr-FR')} vues`}
        >
          <span className="w-36 shrink-0 truncate text-xs text-gray-400 sm:w-48">
            {video.title ?? video.youtubeVideoId}
          </span>
          <div className="h-4 flex-1 rounded bg-white/5">
            <div
              className="h-full rounded"
              style={{ width: `${(video.viewCount / max) * 100}%`, backgroundColor: BAR_COLOR }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs text-gray-500">
            {video.viewCount.toLocaleString('fr-FR')}
          </span>
        </div>
      ))}
    </div>
  )
}
