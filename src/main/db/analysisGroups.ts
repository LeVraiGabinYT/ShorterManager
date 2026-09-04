import { getDb } from './index'
import { getPublishedVideoIdByYoutubeId } from './publishedVideos'
import type { AnalysisGroup } from '../../shared/types'

interface GroupRow {
  id: number
  name: string
  created_at: string
}

function getVideoIds(groupId: number): string[] {
  const rows = getDb()
    .prepare(
      `SELECT pv.youtube_video_id AS youtube_video_id
       FROM analysis_group_videos agv
       JOIN published_videos pv ON pv.id = agv.published_video_id
       WHERE agv.group_id = ?
       ORDER BY pv.published_at DESC`
    )
    .all(groupId) as { youtube_video_id: string }[]
  return rows.map((r) => r.youtube_video_id)
}

function toGroup(row: GroupRow): AnalysisGroup {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    videoIds: getVideoIds(row.id)
  }
}

export function listGroups(): AnalysisGroup[] {
  const rows = getDb()
    .prepare('SELECT * FROM analysis_groups ORDER BY created_at DESC')
    .all() as GroupRow[]
  return rows.map(toGroup)
}

export function createGroup(name: string): AnalysisGroup {
  const result = getDb().prepare('INSERT INTO analysis_groups (name) VALUES (?)').run(name)
  return getGroupById(result.lastInsertRowid as number)
}

export function renameGroup(id: number, name: string): AnalysisGroup {
  getDb().prepare('UPDATE analysis_groups SET name = ? WHERE id = ?').run(name, id)
  return getGroupById(id)
}

export function removeGroup(id: number): void {
  getDb().prepare('DELETE FROM analysis_groups WHERE id = ?').run(id)
}

export function addVideosToGroup(id: number, youtubeVideoIds: string[]): AnalysisGroup {
  const db = getDb()
  const insert = db.prepare(
    'INSERT OR IGNORE INTO analysis_group_videos (group_id, published_video_id) VALUES (?, ?)'
  )
  for (const youtubeVideoId of youtubeVideoIds) {
    const publishedVideoId = getPublishedVideoIdByYoutubeId(youtubeVideoId)
    if (publishedVideoId !== null) insert.run(id, publishedVideoId)
  }
  return getGroupById(id)
}

export function removeVideoFromGroup(id: number, youtubeVideoId: string): AnalysisGroup {
  const publishedVideoId = getPublishedVideoIdByYoutubeId(youtubeVideoId)
  if (publishedVideoId !== null) {
    getDb()
      .prepare('DELETE FROM analysis_group_videos WHERE group_id = ? AND published_video_id = ?')
      .run(id, publishedVideoId)
  }
  return getGroupById(id)
}

function getGroupById(id: number): AnalysisGroup {
  const row = getDb().prepare('SELECT * FROM analysis_groups WHERE id = ?').get(id) as GroupRow
  return toGroup(row)
}
