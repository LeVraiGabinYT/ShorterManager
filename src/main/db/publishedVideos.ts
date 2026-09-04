import { getDb } from './index'
import type { PublishedVideo } from '../../shared/types'

interface PublishedVideoRow {
  id: number
  idea_id: number | null
  youtube_video_id: string
  title: string | null
  description: string | null
  thumbnail_url: string | null
  published_at: string | null
  view_count: number | null
  like_count: number | null
  comment_count: number | null
  average_view_percentage: number | null
  stats_fetched_at: string | null
}

export interface UpsertPublishedVideoInput {
  youtubeVideoId: string
  title: string | null
  description: string | null
  thumbnailUrl: string | null
  publishedAt: string | null
  viewCount: number | null
  likeCount: number | null
  commentCount: number | null
  averageViewPercentage: number | null
}

function getIdeaTagIds(ideaId: number): number[] {
  const rows = getDb().prepare('SELECT tag_id FROM idea_tags WHERE idea_id = ?').all(ideaId) as {
    tag_id: number
  }[]
  return rows.map((r) => r.tag_id)
}

function getOwnTagIds(publishedVideoId: number): number[] {
  const rows = getDb()
    .prepare('SELECT tag_id FROM published_video_tags WHERE published_video_id = ?')
    .all(publishedVideoId) as { tag_id: number }[]
  return rows.map((r) => r.tag_id)
}

function toPublishedVideo(row: PublishedVideoRow): PublishedVideo {
  return {
    id: row.id,
    ideaId: row.idea_id,
    youtubeVideoId: row.youtube_video_id,
    videoUrl: `https://www.youtube.com/shorts/${row.youtube_video_id}`,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    publishedAt: row.published_at,
    viewCount: row.view_count,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    averageViewPercentage: row.average_view_percentage,
    statsFetchedAt: row.stats_fetched_at,
    // A linked video's tags are the linked idea's tags (single source of truth once linked);
    // an unlinked video keeps its own directly-assigned tags.
    tagIds: row.idea_id ? getIdeaTagIds(row.idea_id) : getOwnTagIds(row.id)
  }
}

export function listPublishedVideos(): PublishedVideo[] {
  const rows = getDb()
    .prepare('SELECT * FROM published_videos ORDER BY published_at DESC')
    .all() as PublishedVideoRow[]
  return rows.map(toPublishedVideo)
}

export function upsertPublishedVideo(input: UpsertPublishedVideoInput): void {
  getDb()
    .prepare(
      `INSERT INTO published_videos
         (youtube_video_id, title, description, thumbnail_url, published_at, view_count,
          like_count, comment_count, average_view_percentage, stats_fetched_at)
       VALUES
         (@youtubeVideoId, @title, @description, @thumbnailUrl, @publishedAt, @viewCount,
          @likeCount, @commentCount, @averageViewPercentage, datetime('now'))
       ON CONFLICT(youtube_video_id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         thumbnail_url = excluded.thumbnail_url,
         published_at = excluded.published_at,
         view_count = excluded.view_count,
         like_count = excluded.like_count,
         comment_count = excluded.comment_count,
         average_view_percentage = excluded.average_view_percentage,
         stats_fetched_at = excluded.stats_fetched_at`
    )
    .run(input)
}

export function linkVideoToIdea(youtubeVideoId: string, ideaId: number): void {
  getDb()
    .prepare('UPDATE published_videos SET idea_id = ? WHERE youtube_video_id = ?')
    .run(ideaId, youtubeVideoId)
}

export function unlinkVideo(youtubeVideoId: string): void {
  getDb()
    .prepare('UPDATE published_videos SET idea_id = NULL WHERE youtube_video_id = ?')
    .run(youtubeVideoId)
}

export function setPublishedVideoTags(publishedVideoId: number, tagIds: number[]): void {
  const db = getDb()
  db.prepare('DELETE FROM published_video_tags WHERE published_video_id = ?').run(publishedVideoId)
  const insert = db.prepare(
    'INSERT INTO published_video_tags (published_video_id, tag_id) VALUES (?, ?)'
  )
  for (const tagId of tagIds) {
    insert.run(publishedVideoId, tagId)
  }
}

export function getPublishedVideoIdByYoutubeId(youtubeVideoId: string): number | null {
  const row = getDb()
    .prepare('SELECT id FROM published_videos WHERE youtube_video_id = ?')
    .get(youtubeVideoId) as { id: number } | undefined
  return row?.id ?? null
}
