import type { PublishedVideo, VideoIdea } from '@shared/types'

export type TagFilterMode = 'any' | 'all'

export interface AnalysisFiltersState {
  keyword: string
  tagIds: number[]
  tagMode: TagFilterMode
  objectIds: number[]
}

export const DEFAULT_ANALYSIS_FILTERS: AnalysisFiltersState = {
  keyword: '',
  tagIds: [],
  tagMode: 'any',
  objectIds: []
}

export function isAnalysisFiltersActive(filters: AnalysisFiltersState): boolean {
  return filters.keyword.trim() !== '' || filters.tagIds.length > 0 || filters.objectIds.length > 0
}

/** A video's "objects" are whatever objects its linked idea used — a video has none on its own. */
export function getVideoObjectIds(
  video: PublishedVideo,
  ideasById: Map<number, VideoIdea>
): number[] {
  if (video.ideaId === null) return []
  return ideasById.get(video.ideaId)?.objectIds ?? []
}

export function filterPublishedVideos(
  videos: PublishedVideo[],
  filters: AnalysisFiltersState,
  ideasById: Map<number, VideoIdea>
): PublishedVideo[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return videos.filter((video) => {
    if (keyword) {
      const haystack = `${video.title ?? ''} ${video.description ?? ''}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    if (filters.tagIds.length > 0) {
      const matchCount = filters.tagIds.filter((id) => video.tagIds.includes(id)).length
      if (filters.tagMode === 'all') {
        if (matchCount !== filters.tagIds.length) return false
      } else if (matchCount === 0) {
        return false
      }
    }

    if (filters.objectIds.length > 0) {
      const videoObjectIds = getVideoObjectIds(video, ideasById)
      if (!filters.objectIds.some((id) => videoObjectIds.includes(id))) return false
    }

    return true
  })
}
