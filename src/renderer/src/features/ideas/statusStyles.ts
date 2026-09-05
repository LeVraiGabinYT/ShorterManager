import type { IdeaStatus } from '@shared/types'

export const STATUS_STYLES: Record<IdeaStatus, string> = {
  idea: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  preparation: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  shooting: 'bg-red-500/20 text-red-300 border-red-500/40',
  editing: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  ready: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  scheduled: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  published: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
}

// Row/card background tint matching each status's color code. 'idea' is intentionally empty —
// it stays the plain default background, no color, per the app's status color code.
export const STATUS_ROW_BACKGROUND: Record<IdeaStatus, string> = {
  idea: '',
  preparation: 'bg-orange-500/10 hover:bg-orange-500/15',
  shooting: 'bg-red-500/10 hover:bg-red-500/15',
  editing: 'bg-violet-500/10 hover:bg-violet-500/15',
  ready: 'bg-blue-500/10 hover:bg-blue-500/15',
  scheduled: 'bg-emerald-500/10 hover:bg-emerald-500/15',
  published: 'bg-emerald-500/10 hover:bg-emerald-500/15'
}
