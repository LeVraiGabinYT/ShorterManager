import { listIdeas, removeIdea, updateIdea } from './db/ideas'
import { listPublishedVideos, unlinkVideo } from './db/publishedVideos'
import type { VideoIdea } from '../shared/types'

export interface MergeDuplicatesResult {
  mergedGroups: number
  removedIdeas: number
  backfilledShootDates: number
}

/**
 * Merges every group of ideas sharing the exact same (trimmed) title into one surviving idea:
 * - the idea linked to a real video wins as the base (highest view count if several are linked —
 *   only that one keeps its link, the rest are unlinked so no idea keeps a stale/duplicate link);
 *   otherwise the oldest-created idea is the base.
 * - tags/objects are unioned across the whole group.
 * - publishDate becomes the oldest non-null publishDate in the group.
 * - emoji falls back to the first non-null one in the group if the base has none.
 * Every other idea in the group is deleted.
 *
 * Afterwards, as a general data cleanup pass (not just for merged groups), every idea missing a
 * shootDate but with a publishDate gets shootDate backfilled to that publishDate — a shoot date
 * is assumed to be the publish date when it was never recorded separately.
 */
export function mergeDuplicateIdeas(): MergeDuplicatesResult {
  const allIdeas = listIdeas()
  const allVideos = listPublishedVideos()

  const videoByIdeaId = new Map<number, (typeof allVideos)[number]>()
  for (const video of allVideos) {
    if (video.ideaId !== null) videoByIdeaId.set(video.ideaId, video)
  }

  const groups = new Map<string, VideoIdea[]>()
  for (const idea of allIdeas) {
    const key = idea.title.trim()
    const group = groups.get(key)
    if (group) group.push(idea)
    else groups.set(key, [idea])
  }

  let mergedGroups = 0
  let removedIdeas = 0

  for (const group of groups.values()) {
    if (group.length < 2) continue
    mergedGroups++

    const linkedMembers = group.filter((idea) => videoByIdeaId.has(idea.id))
    const base =
      linkedMembers.length > 0
        ? linkedMembers.reduce((best, current) => {
            const bestViews = videoByIdeaId.get(best.id)?.viewCount ?? -1
            const currentViews = videoByIdeaId.get(current.id)?.viewCount ?? -1
            return currentViews > bestViews ? current : best
          })
        : [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]

    const others = group.filter((idea) => idea.id !== base.id)

    const mergedTagIds = Array.from(new Set(group.flatMap((idea) => idea.tagIds)))
    const mergedObjectIds = Array.from(new Set(group.flatMap((idea) => idea.objectIds)))

    const publishDates = group
      .map((idea) => idea.publishDate)
      .filter((date): date is string => date !== null)
    const oldestPublishDate =
      publishDates.length > 0 ? publishDates.reduce((a, b) => (a < b ? a : b)) : base.publishDate

    const emoji = base.emoji ?? group.find((idea) => idea.emoji !== null)?.emoji ?? null

    updateIdea(base.id, {
      title: base.title,
      emoji,
      description: base.description,
      status: base.status,
      publishDate: oldestPublishDate,
      shootDate: base.shootDate,
      seriesId: base.seriesId,
      objectIds: mergedObjectIds,
      tagIds: mergedTagIds
    })

    for (const other of others) {
      const otherVideo = videoByIdeaId.get(other.id)
      if (otherVideo) unlinkVideo(otherVideo.youtubeVideoId)
      removeIdea(other.id)
      removedIdeas++
    }
  }

  let backfilledShootDates = 0
  for (const idea of listIdeas()) {
    if (idea.shootDate === null && idea.publishDate !== null) {
      updateIdea(idea.id, {
        title: idea.title,
        emoji: idea.emoji,
        description: idea.description,
        status: idea.status,
        publishDate: idea.publishDate,
        shootDate: idea.publishDate,
        seriesId: idea.seriesId,
        objectIds: idea.objectIds,
        tagIds: idea.tagIds
      })
      backfilledShootDates++
    }
  }

  return { mergedGroups, removedIdeas, backfilledShootDates }
}
