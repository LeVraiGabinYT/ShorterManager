import { useEffect, useState, type ReactElement } from 'react'
import type { ChannelStats } from '@shared/types'
import { STAT_CARDS } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { formatRelativeTime } from '../../lib/format'
import {
  STAT_CARD_COLORS,
  STAT_CARD_COMPUTE,
  STAT_CARD_ICONS,
  type StatCardContext
} from './statCards'

export function StatsTab(): ReactElement {
  const data = useIdeasData()
  const [channelConnected, setChannelConnected] = useState(false)
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  useEffect(() => {
    window.api.channel.getStatus().then((status) => setChannelConnected(status.connected))
    window.api.channel.getStats().then(setChannelStats)
  }, [])

  async function handleRefresh(): Promise<void> {
    setRefreshing(true)
    setRefreshError(null)

    const status = await window.api.channel.getStatus()
    setChannelConnected(status.connected)
    if (!status.connected) {
      setRefreshError('Chaîne YouTube non connectée — rien à actualiser (Paramètres).')
      setRefreshing(false)
      return
    }

    const result = await window.api.channel.refreshStats()
    setChannelStats(result.stats)
    if (result.error) setRefreshError(result.error)
    setRefreshing(false)
  }

  const visibleCards = STAT_CARDS.filter((card) =>
    data.settings.statsVisibleCards.includes(card.id)
  )
  const ctx: StatCardContext = { data, channelConnected, channelStats }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Stats</h1>
          {channelStats?.statsFetchedAt && (
            <p className="mt-0.5 text-xs text-gray-500">
              Chiffres de chaîne actualisés {formatRelativeTime(channelStats.statsFetchedAt)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? 'Actualisation...' : '⟳ Actualiser'}
        </button>
      </div>

      {refreshError && (
        <div className="px-6 pb-2">
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {refreshError}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {visibleCards.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune carte affichée — active-en depuis Paramètres.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleCards.map((card) => {
              const result = STAT_CARD_COMPUTE[card.id](ctx)
              const color = STAT_CARD_COLORS[card.id]
              return (
                <div
                  key={card.id}
                  style={{ backgroundColor: `${color}14`, borderColor: `${color}40` }}
                  className={`rounded-lg border p-4 transition-opacity ${
                    result.unavailable ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-medium" style={{ color }}>
                    <span>{STAT_CARD_ICONS[card.id]}</span>
                    <span>{card.label}</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-gray-100">{result.value}</p>
                  {result.subtext && <p className="mt-1 text-xs text-gray-500">{result.subtext}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
