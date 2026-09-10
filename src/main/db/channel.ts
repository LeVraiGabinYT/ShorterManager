import { getDb } from './index'
import type { ChannelStats, ChannelStatus } from '../../shared/types'

interface ChannelConnectionRow {
  id: number
  channel_id: string | null
  channel_title: string | null
  access_token: string | null
  refresh_token: string | null
  token_expiry: string | null
  connected_at: string | null
  subscriber_count: number | null
  hidden_subscriber_count: number | null
  total_view_count: number | null
  video_count: number | null
  channel_stats_fetched_at: string | null
}

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  tokenExpiry: string
}

function getRow(): ChannelConnectionRow | undefined {
  return getDb().prepare('SELECT * FROM channel_connection WHERE id = 1').get() as
    ChannelConnectionRow | undefined
}

export function getChannelStatus(): ChannelStatus {
  const row = getRow()
  return {
    connected: Boolean(row?.refresh_token),
    channelId: row?.channel_id ?? null,
    channelTitle: row?.channel_title ?? null
  }
}

export function getStoredTokens(): StoredTokens | null {
  const row = getRow()
  if (!row?.access_token || !row.refresh_token || !row.token_expiry) return null
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiry: row.token_expiry
  }
}

export function saveChannelConnection(params: {
  channelId: string
  channelTitle: string
  accessToken: string
  refreshToken: string
  tokenExpiry: string
}): void {
  getDb()
    .prepare(
      `INSERT INTO channel_connection
         (id, channel_id, channel_title, access_token, refresh_token, token_expiry, connected_at)
       VALUES (1, @channelId, @channelTitle, @accessToken, @refreshToken, @tokenExpiry, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         channel_id = excluded.channel_id,
         channel_title = excluded.channel_title,
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         token_expiry = excluded.token_expiry,
         connected_at = excluded.connected_at`
    )
    .run(params)
}

export function updateAccessToken(accessToken: string, tokenExpiry: string): void {
  getDb()
    .prepare('UPDATE channel_connection SET access_token = ?, token_expiry = ? WHERE id = 1')
    .run(accessToken, tokenExpiry)
}

export function clearChannelConnection(): void {
  getDb().prepare('DELETE FROM channel_connection WHERE id = 1').run()
}

export function getChannelStats(): ChannelStats {
  const row = getRow()
  return {
    subscriberCount: row?.subscriber_count ?? null,
    hiddenSubscriberCount: Boolean(row?.hidden_subscriber_count),
    totalViewCount: row?.total_view_count ?? null,
    videoCount: row?.video_count ?? null,
    statsFetchedAt: row?.channel_stats_fetched_at ?? null
  }
}

export function saveChannelStats(stats: {
  subscriberCount: number | null
  hiddenSubscriberCount: boolean
  totalViewCount: number | null
  videoCount: number | null
}): void {
  getDb()
    .prepare(
      `UPDATE channel_connection SET
         subscriber_count = @subscriberCount,
         hidden_subscriber_count = @hiddenSubscriberCount,
         total_view_count = @totalViewCount,
         video_count = @videoCount,
         channel_stats_fetched_at = datetime('now')
       WHERE id = 1`
    )
    .run({
      subscriberCount: stats.subscriberCount,
      hiddenSubscriberCount: stats.hiddenSubscriberCount ? 1 : 0,
      totalViewCount: stats.totalViewCount,
      videoCount: stats.videoCount
    })
}
