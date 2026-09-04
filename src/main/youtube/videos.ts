import { getIdeaById, markIdeaPublished, createIdea } from '../db/ideas'
import {
  getPublishedVideoIdByYoutubeId,
  linkVideoToIdea as dbLinkVideoToIdea,
  listPublishedVideos,
  setPublishedVideoTags,
  unlinkVideo as dbUnlinkVideo,
  upsertPublishedVideo
} from '../db/publishedVideos'
import { getValidAccessToken } from './oauth'
import type { PublishedVideo, VideoIdea } from '../../shared/types'

const MAX_RECENT_VIDEOS = 25

async function youtubeFetch<T>(url: string): Promise<T> {
  const token = await getValidAccessToken()
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    throw new Error(`Requête YouTube échouée (${response.status}) : ${url}`)
  }
  return (await response.json()) as T
}

interface PlaylistItem {
  contentDetails: { videoId: string; videoPublishedAt?: string }
  snippet: {
    title: string
    publishedAt: string
    thumbnails?: { medium?: { url: string }; default?: { url: string } }
  }
}

async function getUploadsPlaylistId(): Promise<string> {
  const data = await youtubeFetch<{
    items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[]
  }>('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true')

  const uploads = data.items?.[0]?.contentDetails.relatedPlaylists.uploads
  if (!uploads) throw new Error('Impossible de trouver la playlist des vidéos publiées.')
  return uploads
}

async function getRecentPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
  const data = await youtubeFetch<{ items?: PlaylistItem[] }>(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${MAX_RECENT_VIDEOS}&playlistId=${playlistId}`
  )
  return data.items ?? []
}

async function getVideoStatistics(
  videoIds: string[]
): Promise<Map<string, { viewCount: number; likeCount: number; commentCount: number }>> {
  if (videoIds.length === 0) return new Map()

  const data = await youtubeFetch<{
    items?: { id: string; statistics: Record<string, string> }[]
  }>(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(',')}`)

  const result = new Map<string, { viewCount: number; likeCount: number; commentCount: number }>()
  for (const item of data.items ?? []) {
    result.set(item.id, {
      viewCount: Number(item.statistics.viewCount ?? 0),
      likeCount: Number(item.statistics.likeCount ?? 0),
      commentCount: Number(item.statistics.commentCount ?? 0)
    })
  }
  return result
}

/** Best-effort: retention isn't available from the Data API, only YouTube Analytics. */
async function getAverageViewPercentages(videoIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (videoIds.length === 0) return result

  try {
    const endDate = new Date().toISOString().slice(0, 10)
    const url =
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE` +
      `&startDate=2005-01-01&endDate=${endDate}&metrics=averageViewPercentage&dimensions=video` +
      `&filters=video%3D%3D${videoIds.join(',')}&maxResults=${videoIds.length}`

    const data = await youtubeFetch<{ rows?: [string, number][] }>(url)
    for (const [videoId, percentage] of data.rows ?? []) {
      result.set(videoId, percentage)
    }
  } catch {
    // Non-blocking: retention is a bonus metric, the rest of the fetch must still succeed.
  }

  return result
}

export async function refreshRecentVideos(): Promise<PublishedVideo[]> {
  const playlistId = await getUploadsPlaylistId()
  const items = await getRecentPlaylistItems(playlistId)
  const videoIds = items.map((item) => item.contentDetails.videoId)

  const [stats, retention] = await Promise.all([
    getVideoStatistics(videoIds),
    getAverageViewPercentages(videoIds)
  ])

  for (const item of items) {
    const videoId = item.contentDetails.videoId
    const videoStats = stats.get(videoId)
    upsertPublishedVideo({
      youtubeVideoId: videoId,
      title: item.snippet.title,
      thumbnailUrl:
        item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
      publishedAt: item.contentDetails.videoPublishedAt ?? item.snippet.publishedAt,
      viewCount: videoStats?.viewCount ?? null,
      likeCount: videoStats?.likeCount ?? null,
      commentCount: videoStats?.commentCount ?? null,
      averageViewPercentage: retention.get(videoId) ?? null
    })
  }

  return listPublishedVideos()
}

export function createIdeaFromVideo(youtubeVideoId: string): VideoIdea {
  const video = listPublishedVideos().find((v) => v.youtubeVideoId === youtubeVideoId)
  if (!video) throw new Error('Vidéo introuvable.')

  const idea = createIdea({
    title: video.title ?? 'Vidéo sans titre',
    emoji: null,
    description: null,
    status: 'published',
    publishDate: video.publishedAt ? video.publishedAt.slice(0, 10) : null,
    shootDate: null,
    objectIds: [],
    tagIds: []
  })

  dbLinkVideoToIdea(youtubeVideoId, idea.id)
  return getIdeaById(idea.id)
}

export function linkVideoToIdea(youtubeVideoId: string, ideaId: number): void {
  const video = listPublishedVideos().find((v) => v.youtubeVideoId === youtubeVideoId)
  dbLinkVideoToIdea(youtubeVideoId, ideaId)
  markIdeaPublished(ideaId, video?.publishedAt ? video.publishedAt.slice(0, 10) : null)
}

export function unlinkVideo(youtubeVideoId: string): void {
  dbUnlinkVideo(youtubeVideoId)
}

export function setVideoTags(youtubeVideoId: string, tagIds: number[]): void {
  const publishedVideoId = getPublishedVideoIdByYoutubeId(youtubeVideoId)
  if (publishedVideoId === null) throw new Error('Vidéo introuvable.')
  setPublishedVideoTags(publishedVideoId, tagIds)
}
