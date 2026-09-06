import type { VideoIdea } from '@shared/types'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function todayDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function shiftDateByDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Ideas whose publish date hasn't happened yet (today counts as not-yet-passed) — the ones a
 * schedule shift should touch when an imprévu pushes the whole plan by a day.
 */
export function ideasWithUpcomingPublishDate(ideas: VideoIdea[]): VideoIdea[] {
  const today = todayDateString()
  return ideas.filter((idea) => idea.publishDate !== null && idea.publishDate >= today)
}
