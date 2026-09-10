import type { ChannelStats, StatCardId } from '@shared/types'
import type { IdeasData } from '../../hooks/useIdeasData'
import { formatNumber } from '../../lib/format'
import { IN_PROGRESS_STATUSES } from '../../lib/ideaFilters'
import { isTaskOverdue } from '../../lib/taskUrgency'
import { computeVideoStats } from '../../lib/videoStats'

export interface StatCardValue {
  value: string
  subtext?: string
  // Dims the card — used when a channel-dependent card has nothing real to show yet (not
  // connected, or never actualisé).
  unavailable?: boolean
}

export interface StatCardContext {
  data: IdeasData
  channelConnected: boolean
  channelStats: ChannelStats | null
}

export const STAT_CARD_ICONS: Record<StatCardId, string> = {
  subscribers: '👥',
  totalChannelViews: '👁️',
  channelVideoCount: '🎬',
  localPublishedVideos: '📼',
  ideasTotal: '💡',
  ideasInProgress: '🛠️',
  ideasScheduled: '📅',
  ideasPublished: '✅',
  tagsCount: '🏷️',
  seriesCount: '📚',
  objectsCount: '📦',
  objectsPurchased: '🛒',
  objectsMissing: '❗',
  tasksPending: '📋',
  tasksOverdue: '⏰',
  avgViewsPerVideo: '📊',
  totalLikes: '👍',
  totalComments: '💬'
}

// Grouped by theme (chaîne, idées, objets, tags/séries, tâches, vidéos) so cards from the same
// family read as related at a glance — same accent-color-on-dark-background treatment already
// used for the idea Kanban columns and the Analyse groups.
export const STAT_CARD_COLORS: Record<StatCardId, string> = {
  subscribers: '#ef4444',
  totalChannelViews: '#f97316',
  channelVideoCount: '#f59e0b',
  localPublishedVideos: '#06b6d4',
  ideasTotal: '#3b82f6',
  ideasInProgress: '#f97316',
  ideasScheduled: '#10b981',
  ideasPublished: '#22c55e',
  tagsCount: '#ec4899',
  seriesCount: '#8b5cf6',
  objectsCount: '#eab308',
  objectsPurchased: '#3b82f6',
  objectsMissing: '#ef4444',
  tasksPending: '#f59e0b',
  tasksOverdue: '#ef4444',
  avgViewsPerVideo: '#06b6d4',
  totalLikes: '#ec4899',
  totalComments: '#8b5cf6'
}

// Every channel-statistics card shares the same "not connected / never actualisé / hidden by the
// channel" gates — factored out so each card only names which number it wants.
function channelCard(
  ctx: StatCardContext,
  getValue: (stats: ChannelStats) => number | null,
  isHidden?: (stats: ChannelStats) => boolean
): StatCardValue {
  if (!ctx.channelConnected) {
    return { value: '—', subtext: 'Chaîne non connectée', unavailable: true }
  }
  if (!ctx.channelStats?.statsFetchedAt) {
    return { value: '—', subtext: 'Clique sur Actualiser', unavailable: true }
  }
  if (isHidden?.(ctx.channelStats)) {
    return { value: '—', subtext: 'Masqué par la chaîne' }
  }
  const value = getValue(ctx.channelStats)
  return { value: value !== null ? formatNumber(value) : '—' }
}

function sum(values: (number | null)[]): number {
  return values.reduce<number>((total, v) => total + (v ?? 0), 0)
}

export const STAT_CARD_COMPUTE: Record<StatCardId, (ctx: StatCardContext) => StatCardValue> = {
  subscribers: (ctx) =>
    channelCard(
      ctx,
      (s) => s.subscriberCount,
      (s) => s.hiddenSubscriberCount
    ),
  totalChannelViews: (ctx) => channelCard(ctx, (s) => s.totalViewCount),
  channelVideoCount: (ctx) => channelCard(ctx, (s) => s.videoCount),

  localPublishedVideos: (ctx) => ({ value: formatNumber(ctx.data.publishedVideos.length) }),

  ideasTotal: (ctx) => ({ value: formatNumber(ctx.data.ideas.length) }),
  ideasInProgress: (ctx) => ({
    value: formatNumber(
      ctx.data.ideas.filter((i) => IN_PROGRESS_STATUSES.includes(i.status)).length
    )
  }),
  ideasScheduled: (ctx) => ({
    value: formatNumber(ctx.data.ideas.filter((i) => i.status === 'scheduled').length)
  }),
  ideasPublished: (ctx) => ({
    value: formatNumber(ctx.data.ideas.filter((i) => i.status === 'published').length)
  }),

  tagsCount: (ctx) => ({ value: formatNumber(ctx.data.tags.length) }),
  seriesCount: (ctx) => ({ value: formatNumber(ctx.data.series.length) }),

  objectsCount: (ctx) => ({ value: formatNumber(ctx.data.objects.length) }),
  objectsPurchased: (ctx) => ({
    value: formatNumber(ctx.data.objects.filter((o) => o.purchased).length)
  }),
  objectsMissing: (ctx) => ({
    value: formatNumber(ctx.data.objects.filter((o) => !o.purchased).length)
  }),

  tasksPending: (ctx) => ({
    value: formatNumber(ctx.data.tasks.filter((t) => t.status === 'pending').length)
  }),
  tasksOverdue: (ctx) => ({
    value: formatNumber(ctx.data.tasks.filter((t) => isTaskOverdue(t)).length)
  }),

  avgViewsPerVideo: (ctx) => {
    const stats = computeVideoStats(ctx.data.publishedVideos)
    return { value: stats.avgViews !== null ? formatNumber(Math.round(stats.avgViews)) : '—' }
  },
  totalLikes: (ctx) => ({
    value: formatNumber(sum(ctx.data.publishedVideos.map((v) => v.likeCount)))
  }),
  totalComments: (ctx) => ({
    value: formatNumber(sum(ctx.data.publishedVideos.map((v) => v.commentCount)))
  })
}
