import type { IdeaStatus, OwnedObject, Tag, VideoIdea } from '@shared/types'
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
  seriesIds: number[]
  shootDate: DateFilter
  publishDate: DateFilter
}

export const DEFAULT_IDEA_FILTERS: IdeaFiltersState = {
  keyword: '',
  statuses: [],
  tagIds: [],
  tagMode: 'any',
  objectIds: [],
  seriesIds: [],
  shootDate: EMPTY_DATE_FILTER,
  publishDate: EMPTY_DATE_FILTER
}

// Statuses shown by the "En cours" quick filter — everything past the idea stage but not yet
// scheduled or published.
export const IN_PROGRESS_STATUSES: IdeaStatus[] = ['preparation', 'shooting', 'editing', 'ready']

// Statuses shown by the "Idées" quick filter — only ideas not yet in preparation.
export const IDEA_ONLY_STATUSES: IdeaStatus[] = ['idea']

export function sameStatusSet(a: IdeaStatus[], b: IdeaStatus[]): boolean {
  return a.length === b.length && b.every((status) => a.includes(status))
}

export function isFiltersActive(filters: IdeaFiltersState): boolean {
  return (
    filters.keyword.trim() !== '' ||
    !sameStatusSet(filters.statuses, DEFAULT_IDEA_FILTERS.statuses) ||
    filters.tagIds.length > 0 ||
    filters.objectIds.length > 0 ||
    filters.seriesIds.length > 0 ||
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

export type IdeaSortField = 'default' | 'shootDate' | 'publishDate'
export type SortDirection = 'asc' | 'desc'

export interface IdeaSortState {
  field: IdeaSortField
  direction: SortDirection
}

export const DEFAULT_IDEA_SORT: IdeaSortState = { field: 'publishDate', direction: 'desc' }

export function sortIdeas(ideas: VideoIdea[], sort: IdeaSortState): VideoIdea[] {
  if (sort.field === 'default') return ideas

  const field = sort.field
  const sign = sort.direction === 'asc' ? 1 : -1

  return [...ideas].sort((a, b) => {
    const aValue = a[field]
    const bValue = b[field]
    if (aValue === null && bValue === null) return 0
    if (aValue === null) return 1
    if (bValue === null) return -1
    return aValue < bValue ? -sign : aValue > bValue ? sign : 0
  })
}

export function filterIdeas(
  ideas: VideoIdea[],
  filters: IdeaFiltersState,
  objectsById: Map<number, OwnedObject>,
  tagsById: Map<number, Tag>,
  ruleMissingObjectsPreparation = true
): VideoIdea[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return ideas.filter((idea) => {
    if (keyword) {
      const tagNames = idea.tagIds.map((id) => tagsById.get(id)?.name ?? '').join(' ')
      const haystack = `${idea.title} ${idea.description ?? ''} ${tagNames}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }

    if (filters.statuses.length > 0) {
      const { status } = getEffectiveStatus(idea, objectsById, ruleMissingObjectsPreparation)
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

    if (filters.seriesIds.length > 0) {
      if (idea.seriesId === null || !filters.seriesIds.includes(idea.seriesId)) return false
    }

    if (!matchesDateFilter(idea.shootDate, filters.shootDate)) return false
    if (!matchesDateFilter(idea.publishDate, filters.publishDate)) return false

    return true
  })
}
