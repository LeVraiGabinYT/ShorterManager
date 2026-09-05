import type { OwnedObject, VideoIdea } from '@shared/types'

function toTime(dateStr: string | null): number {
  if (!dateStr) return Number.POSITIVE_INFINITY
  const t = new Date(dateStr).getTime()
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

function earlierDate(a: string | null, b: string | null): string | null {
  if (a === null) return b
  if (b === null) return a
  return toTime(a) <= toTime(b) ? a : b
}

/** The date that makes an idea urgent: whichever of shoot/publish comes first, ignoring nulls. */
export function ideaUrgencyDate(idea: VideoIdea): string | null {
  return earlierDate(idea.shootDate, idea.publishDate)
}

/** Sorts by an item's date ascending, soonest first — items with no date sink to the bottom. */
export function sortByUrgency<T>(items: T[], dateSelector: (item: T) => string | null): T[] {
  return [...items].sort((a, b) => toTime(dateSelector(a)) - toTime(dateSelector(b)))
}

export interface ObjectToBuy {
  object: OwnedObject
  nearestDate: string | null
  neededByIdeas: VideoIdea[]
}

/**
 * Not-yet-purchased objects, prioritized by the nearest shoot/publish date among the ideas that
 * need them — an object needed for a shoot next week outranks one for an idea with no date yet.
 */
export function objectsToBuy(objects: OwnedObject[], ideas: VideoIdea[]): ObjectToBuy[] {
  const ideasByObjectId = new Map<number, VideoIdea[]>()
  for (const idea of ideas) {
    for (const objectId of idea.objectIds) {
      const list = ideasByObjectId.get(objectId)
      if (list) list.push(idea)
      else ideasByObjectId.set(objectId, [idea])
    }
  }

  const entries = objects
    .filter((o) => !o.purchased)
    .map((object) => {
      const neededByIdeas = ideasByObjectId.get(object.id) ?? []
      const nearestDate = neededByIdeas
        .map(ideaUrgencyDate)
        .reduce<string | null>((min, d) => earlierDate(min, d), null)
      return { object, nearestDate, neededByIdeas }
    })

  return sortByUrgency(entries, (e) => e.nearestDate)
}
