import type { IdeaStatus, OverviewSectionId } from '@shared/types'

// "Objets à acheter" has no matching status, so it gets a fixed accent instead — the same amber
// already used for its date badge in the Vue d'ensemble.
export const OBJECTS_SECTION_COLOR = '#f59e0b'

// "Tâches à faire" isn't tied to an idea status either — pink keeps it visually distinct from
// the amber objects section right next to it.
export const TASKS_SECTION_COLOR = '#ec4899'

// Which status color each Vue d'ensemble section borrows — kept in one place so a section's box,
// its row in Personnalisation's drag list, and any other place it's shown always match.
export const OVERVIEW_SECTION_STATUS: Partial<Record<OverviewSectionId, IdeaStatus>> = {
  preparation: 'preparation',
  shooting: 'shooting',
  editing: 'editing',
  toSchedule: 'ready',
  scheduled: 'scheduled'
}

export function overviewSectionColor(
  id: OverviewSectionId,
  statusColors: Record<IdeaStatus, string>
): string {
  if (id === 'tasks') return TASKS_SECTION_COLOR
  const status = OVERVIEW_SECTION_STATUS[id]
  return status ? statusColors[status] : OBJECTS_SECTION_COLOR
}
