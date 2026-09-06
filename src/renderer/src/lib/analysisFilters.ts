import type { PublishedVideo, VideoIdea } from '@shared/types'

/** A video's "objects" are whatever objects its linked idea used — a video has none on its own. */
export function getVideoObjectIds(
  video: PublishedVideo,
  ideasById: Map<number, VideoIdea>
): number[] {
  if (video.ideaId === null) return []
  return ideasById.get(video.ideaId)?.objectIds ?? []
}

/** A video's série is its linked idea's série — a video has none of its own. */
export function getVideoSeriesId(
  video: PublishedVideo,
  ideasById: Map<number, VideoIdea>
): number | null {
  if (video.ideaId === null) return null
  return ideasById.get(video.ideaId)?.seriesId ?? null
}
