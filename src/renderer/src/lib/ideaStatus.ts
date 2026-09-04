import type { IdeaStatus, OwnedObject, VideoIdea } from '@shared/types'

export interface EffectiveStatus {
  status: IdeaStatus
  missingObjects: boolean
}

/**
 * An idea's stored status is what the user picked manually, but a missing (not-yet-purchased)
 * linked object forces it back to "Préparation" for display/counting purposes, regardless of the
 * manually selected status — until every needed object is marked as purchased.
 */
export function getEffectiveStatus(
  idea: VideoIdea,
  objectsById: Map<number, OwnedObject>
): EffectiveStatus {
  const missingObjects = idea.objectIds.some((id) => objectsById.get(id)?.purchased === false)

  if (missingObjects && idea.status !== 'published') {
    return { status: 'preparation', missingObjects: true }
  }

  return { status: idea.status, missingObjects: false }
}
