import type { IdeaStatus, OwnedObject, VideoIdea } from '@shared/types'
import { getEffectiveStatus } from './ideaStatus'

export type DateFilterMode = 'any' | 'exact' | 'range'

export interface DateFilter {
  mode: DateFilterMode
  exact: string
  from: string
  to: string
}

export const EMPTY_DATE_FILTER: DateFilter = { mode: 'any', exact: '', from: '', to: '' }

export type TagFilterMode = 'any' | 'all'

export interface IdeaFiltersState {
  keyword: string
  statuses: IdeaStatus[]
  tagIds: number[]
  tagMode: TagFilterMode
  objectIds: number[]
  shootDate: DateFilter
  publishDate: DateFilter
}

export const DEFAULT_IDEA_FILTERS: IdeaFiltersState = {
  keyword: '',
  statuses: [],
  tagIds: [],
  tagMode: 'any',
  objectIds: [],
  shootDate: EMPTY_DATE_FILTER,
  publishDate: EMPTY_DATE_FILTER
}

export function isFiltersActive(filters: IdeaFiltersState): boolean {
  return (
    filters.keyword.trim() !== '' ||
    filters.statuses.length > 0 ||
    filters.tagIds.length > 0 ||
    filters.objectIds.length > 0 ||
    filters.shootDate.mode !== 'any' ||
    filters.publishDate.mode !== 'any'
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

export function filterIdeas(
  ideas: VideoIdea[],
  filters: IdeaFiltersState,
  objectsById: Map<number, OwnedObject>
): VideoIdea[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return ideas.filter((idea) => {
    if (keyword) {
      const haystack = `${idea.title} ${idea.description ?? ''}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    if (filters.statuses.length > 0) {
      const { status } = getEffectiveStatus(idea, objectsById)
      if (!filters.statuses.includes(status)) return false
    }

    if (filters.tagIds.length > 0) {
      const matchCount = filters.tagIds.filter((id) => idea.tagIds.includes(id)).length
      if (filters.tagMode === 'all') {
        if (matchCount !== filters.tagIds.length) return false
      } else if (matchCount === 0) {
        return false
      }
    }

    if (filters.objectIds.length > 0) {
      const hasAny = filters.objectIds.some((id) => idea.objectIds.includes(id))
      if (!hasAny) return false
    }

    if (!matchesDateFilter(idea.shootDate, filters.shootDate)) return false
    if (!matchesDateFilter(idea.publishDate, filters.publishDate)) return false

    return true
  })
}
