import type { PublishedVideo, VideoIdea } from '@shared/types'
import { computeVideoStats } from './videoStats'

export interface SeriesStats {
  episodeCount: number
  lastEpisodeDate: string | null
  avgViews: number | null
}

function latestDate(a: string | null, b: string | null): string | null {
  if (a === null) return b
  if (b === null) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

/**
 * A series' "last episode" date is whichever of an idea's publish/shoot date is most recent —
 * publish date once it's out, shoot date as a stand-in while it's still in the pipeline.
 */
export function computeSeriesStats(
  ideas: VideoIdea[],
  publishedVideosByIdeaId: Map<number, PublishedVideo>
): SeriesStats {
  const lastEpisodeDate = ideas.reduce<string | null>(
    (latest, idea) => latestDate(latest, idea.publishDate ?? idea.shootDate),
    null
  )
  const linkedVideos = ideas
    .map((idea) => publishedVideosByIdeaId.get(idea.id))
    .filter((v): v is PublishedVideo => v !== undefined)

  return {
    episodeCount: ideas.length,
    lastEpisodeDate,
    avgViews: computeVideoStats(linkedVideos).avgViews
  }
}
