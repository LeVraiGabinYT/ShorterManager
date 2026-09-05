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

export type CriterionType = 'tag' | 'object' | 'series' | 'keyword'

export interface Criterion {
  type: CriterionType
  value: string
}

export const EMPTY_CRITERION: Criterion = { type: 'tag', value: '' }

export function isCriterionSet(criterion: Criterion): boolean {
  return criterion.value.trim() !== ''
}

export function videoMatchesCriterion(
  video: PublishedVideo,
  criterion: Criterion,
  ideasById: Map<number, VideoIdea>
): boolean {
  if (!isCriterionSet(criterion)) return false

  switch (criterion.type) {
    case 'tag':
      return video.tagIds.includes(Number(criterion.value))
    case 'object':
      return getVideoObjectIds(video, ideasById).includes(Number(criterion.value))
    case 'series':
      return getVideoSeriesId(video, ideasById) === Number(criterion.value)
    case 'keyword': {
      const keyword = criterion.value.trim().toLowerCase()
      return `${video.title ?? ''} ${video.description ?? ''}`.toLowerCase().includes(keyword)
    }
  }
}

export function ideaMatchesCriterion(idea: VideoIdea, criterion: Criterion): boolean {
  if (!isCriterionSet(criterion)) return false

  switch (criterion.type) {
    case 'tag':
      return idea.tagIds.includes(Number(criterion.value))
    case 'object':
      return idea.objectIds.includes(Number(criterion.value))
    case 'series':
      return idea.seriesId === Number(criterion.value)
    case 'keyword': {
      const keyword = criterion.value.trim().toLowerCase()
      return `${idea.title} ${idea.description ?? ''}`.toLowerCase().includes(keyword)
    }
  }
}
