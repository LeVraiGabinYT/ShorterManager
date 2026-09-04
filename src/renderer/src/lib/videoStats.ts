import type { PublishedVideo } from '@shared/types'

export interface VideoStatsSummary {
  count: number
  avgViews: number | null
  avgLikes: number | null
  avgComments: number | null
  avgRetention: number | null
  best: PublishedVideo | null
  worst: PublishedVideo | null
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function computeVideoStats(videos: PublishedVideo[]): VideoStatsSummary {
  const withViews = videos.filter(
    (v): v is PublishedVideo & { viewCount: number } => typeof v.viewCount === 'number'
  )

  if (withViews.length === 0) {
    return {
      count: videos.length,
      avgViews: null,
      avgLikes: null,
      avgComments: null,
      avgRetention: null,
      best: null,
      worst: null
    }
  }

  const likes = withViews.filter((v) => typeof v.likeCount === 'number')
  const comments = withViews.filter((v) => typeof v.commentCount === 'number')
  const retention = withViews.filter((v) => typeof v.averageViewPercentage === 'number')
  const sortedByViews = [...withViews].sort((a, b) => b.viewCount - a.viewCount)

  return {
    count: videos.length,
    avgViews: average(withViews.map((v) => v.viewCount)),
    avgLikes: likes.length > 0 ? average(likes.map((v) => v.likeCount as number)) : null,
    avgComments:
      comments.length > 0 ? average(comments.map((v) => v.commentCount as number)) : null,
    avgRetention:
      retention.length > 0
        ? average(retention.map((v) => v.averageViewPercentage as number))
        : null,
    best: sortedByViews[0],
    worst: sortedByViews[sortedByViews.length - 1]
  }
}
