import type { PublishedVideo, Tag, VideoIdea } from '@shared/types'
import { getVideoObjectIds, getVideoSeriesId } from './analysisFilters'
import { type DateFilter, EMPTY_DATE_FILTER, type TagFilterMode } from './ideaFilters'

export interface VideoFiltersState {
  keyword: string
  tagIds: number[]
  tagMode: TagFilterMode
  objectIds: number[]
  seriesIds: number[]
  publishedDate: DateFilter
}

export const DEFAULT_VIDEO_FILTERS: VideoFiltersState = {
  keyword: '',
  tagIds: [],
  tagMode: 'any',
  objectIds: [],
  seriesIds: [],
  publishedDate: EMPTY_DATE_FILTER
}

export function isVideoFiltersActive(filters: VideoFiltersState): boolean {
  return (
    filters.keyword.trim() !== '' ||
    filters.tagIds.length > 0 ||
    filters.objectIds.length > 0 ||
    filters.seriesIds.length > 0 ||
    filters.publishedDate.mode !== 'any'
  )
}

function matchesDateFilter(value: string | null, filter: DateFilter): boolean {
  if (filter.mode === 'any') return true
  if (!value) return false
  const date = value.slice(0, 10)

  if (filter.mode === 'exact') {
    return filter.exact ? date === filter.exact : true
  }

  if (filter.from && date < filter.from) return false
  if (filter.to && date > filter.to) return false
  return true
}

export function filterPublishedVideosByState(
  videos: PublishedVideo[],
  filters: VideoFiltersState,
  ideasById: Map<number, VideoIdea>,
  tagsById: Map<number, Tag>
): PublishedVideo[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return videos.filter((video) => {
    if (keyword) {
      const tagNames = video.tagIds.map((id) => tagsById.get(id)?.name ?? '').join(' ')
      const haystack = `${video.title ?? ''} ${video.description ?? ''} ${tagNames}`.toLowerCase()
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

    if (filters.seriesIds.length > 0) {
      const seriesId = getVideoSeriesId(video, ideasById)
      if (seriesId === null || !filters.seriesIds.includes(seriesId)) return false
    }

    if (!matchesDateFilter(video.publishedAt, filters.publishedDate)) return false

    return true
  })
}
