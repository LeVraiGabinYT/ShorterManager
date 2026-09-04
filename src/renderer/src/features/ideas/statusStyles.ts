import type { IdeaStatus } from '@shared/types'

export const STATUS_STYLES: Record<IdeaStatus, string> = {
  idea: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  shooting: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  editing: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  published: 'bg-teal-500/20 text-teal-300 border-teal-500/40'
}
