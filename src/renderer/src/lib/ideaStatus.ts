import type { IdeaStatus, OwnedObject, VideoIdea } from '@shared/types'

export interface EffectiveStatus {
  status: IdeaStatus
  missingObjects: boolean
}

/**
 * An idea's stored status is what the user picked manually, but a missing (not-yet-purchased)
 * linked object forces it back to "Préparation" for display/counting purposes, regardless of the
 * manually selected status — until every needed object is marked as purchased. This is the
 * "Règle" ruleMissingObjectsPreparation, on by default and toggleable in Paramètres.
 *
 * Exceptions: "Publiée" is never touched (already shipped), and "Idée" is never touched either —
 * an idea that hasn't started production yet isn't "in préparation" just because it references an
 * object nobody's bought; that only matters once you actually move it toward shooting/editing.
 */
export function getEffectiveStatus(
  idea: VideoIdea,
  objectsById: Map<number, OwnedObject>,
  ruleMissingObjectsPreparation = true
): EffectiveStatus {
  const missingObjects = idea.objectIds.some((id) => objectsById.get(id)?.purchased === false)

  if (
    ruleMissingObjectsPreparation &&
    missingObjects &&
    idea.status !== 'published' &&
    idea.status !== 'idea'
  ) {
    return { status: 'preparation', missingObjects: true }
  }

  return { status: idea.status, missingObjects: false }
}
