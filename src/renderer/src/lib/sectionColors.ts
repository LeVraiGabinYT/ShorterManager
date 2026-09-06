import type { IdeaStatus, OverviewSectionId } from '@shared/types'

// "Objets à acheter" has no matching status, so it gets a fixed accent instead — the same amber
// already used for its date badge in the Vue d'ensemble.
export const OBJECTS_SECTION_COLOR = '#f59e0b'

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
  const status = OVERVIEW_SECTION_STATUS[id]
  return status ? statusColors[status] : OBJECTS_SECTION_COLOR
}
