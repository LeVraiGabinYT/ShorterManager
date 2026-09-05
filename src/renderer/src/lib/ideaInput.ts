import type { VideoIdea, VideoIdeaInput } from '@shared/types'

export function toIdeaInput(idea: VideoIdea): VideoIdeaInput {
  return {
    title: idea.title,
    emoji: idea.emoji,
    description: idea.description,
    status: idea.status,
    publishDate: idea.publishDate,
    shootDate: idea.shootDate,
    objectIds: idea.objectIds,
    tagIds: idea.tagIds,
    seriesId: idea.seriesId
  }
}
