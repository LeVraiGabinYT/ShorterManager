import { getIdeaById, setIdeaLinkedStatus, createIdea, updateIdea } from '../db/ideas'
import {
  getPublishedVideoIdByYoutubeId,
  linkVideoToIdea as dbLinkVideoToIdea,
  listPublishedVideos,
  setPublishedVideoTags,
  unlinkVideo as dbUnlinkVideo,
  upsertPublishedVideo
} from '../db/publishedVideos'
import { getValidAccessToken } from './oauth'
import { loadSettings } from '../settings'
import type { PublishedVideo, VideoIdea } from '../../shared/types'

/**
 * "Règle" (toggleable in Paramètres): linking a real video normally forces the idea to
 * "Publiée" — but a video dated today with 0 views is almost certainly still a scheduled
 * premiere/upload rather than truly live yet, so it's marked "Programmée" instead.
 */
function computeAutoLinkedStatus(video: PublishedVideo): 'published' | 'scheduled' {
  const publishDateStr = video.publishedAt ? video.publishedAt.slice(0, 10) : null
  const today = new Date().toISOString().slice(0, 10)
  const looksScheduled = publishDateStr === today && (video.viewCount ?? 0) === 0
  return looksScheduled ? 'scheduled' : 'published'
}

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
    description?: string
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
  const maxResults = loadSettings().maxRecentVideos
  const data = await youtubeFetch<{ items?: PlaylistItem[] }>(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${maxResults}&playlistId=${playlistId}`
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

interface VideoMeta {
  videoId: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  publishedAt: string
}

async function upsertVideoMetas(metas: VideoMeta[]): Promise<void> {
  const videoIds = metas.map((m) => m.videoId)
  const [stats, retention] = await Promise.all([
    getVideoStatistics(videoIds),
    getAverageViewPercentages(videoIds)
  ])

  for (const meta of metas) {
    const videoStats = stats.get(meta.videoId)
    upsertPublishedVideo({
      youtubeVideoId: meta.videoId,
      title: meta.title,
      description: meta.description,
      thumbnailUrl: meta.thumbnailUrl,
      publishedAt: meta.publishedAt,
      viewCount: videoStats?.viewCount ?? null,
      likeCount: videoStats?.likeCount ?? null,
      commentCount: videoStats?.commentCount ?? null,
      averageViewPercentage: retention.get(meta.videoId) ?? null
    })
  }
}

export async function refreshRecentVideos(): Promise<PublishedVideo[]> {
  const playlistId = await getUploadsPlaylistId()
  const items = await getRecentPlaylistItems(playlistId)

  await upsertVideoMetas(
    items.map((item) => ({
      videoId: item.contentDetails.videoId,
      title: item.snippet.title,
      description: item.snippet.description ?? null,
      thumbnailUrl:
        item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
      publishedAt: item.contentDetails.videoPublishedAt ?? item.snippet.publishedAt
    }))
  )

  return listPublishedVideos()
}

interface SearchResultItem {
  id: { videoId: string }
  snippet: {
    title: string
    description?: string
    publishedAt: string
    thumbnails?: { medium?: { url: string }; default?: { url: string } }
  }
}

/**
 * Searches the whole channel (not just the most recently cached videos) via the Data API's
 * search endpoint — needed because refreshRecentVideos() only ever caches the configured
 * maxRecentVideos setting's worth of uploads, so older videos need an explicit lookup.
 */
export async function searchChannelVideos(query: string): Promise<PublishedVideo[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const data = await youtubeFetch<{ items?: SearchResultItem[] }>(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&order=date&maxResults=25&q=${encodeURIComponent(trimmed)}`
  )
  const items = data.items ?? []
  if (items.length === 0) return []

  await upsertVideoMetas(
    items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description ?? null,
      thumbnailUrl:
        item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
      publishedAt: item.snippet.publishedAt
    }))
  )

  const foundIds = new Set(items.map((item) => item.id.videoId))
  return listPublishedVideos().filter((v) => foundIds.has(v.youtubeVideoId))
}

export function createIdeaFromVideo(youtubeVideoId: string): VideoIdea {
  const video = listPublishedVideos().find((v) => v.youtubeVideoId === youtubeVideoId)
  if (!video) throw new Error('Vidéo introuvable.')

  const autoStatusRule = loadSettings().ruleAutoStatusOnLink

  const idea = createIdea({
    title: video.title ?? 'Vidéo sans titre',
    emoji: null,
    description: null,
    status: autoStatusRule ? computeAutoLinkedStatus(video) : 'idea',
    publishDate: video.publishedAt ? video.publishedAt.slice(0, 10) : null,
    shootDate: null,
    objectIds: [],
    // Carry over any tags already assigned directly to the video (e.g. from the detail
    // modal) — otherwise they'd be silently lost once idea_tags becomes the source of
    // truth for this now-linked video's tags. Mirrors the merge linkVideoToIdea() does.
    tagIds: video.tagIds,
    seriesId: null
  })

  dbLinkVideoToIdea(youtubeVideoId, idea.id)
  return getIdeaById(idea.id)
}

export function linkVideoToIdea(youtubeVideoId: string, ideaId: number): VideoIdea {
  const video = listPublishedVideos().find((v) => v.youtubeVideoId === youtubeVideoId)

  // A video's own (pre-link) tags would otherwise become invisible once idea_tags takes over as
  // the source of truth for a linked video's tags — merge them into the idea first so nothing
  // is silently lost.
  if (video && video.tagIds.length > 0) {
    const idea = getIdeaById(ideaId)
    const mergedTagIds = Array.from(new Set([...idea.tagIds, ...video.tagIds]))
    if (mergedTagIds.length !== idea.tagIds.length) {
      updateIdea(ideaId, { ...idea, tagIds: mergedTagIds })
    }
  }

  dbLinkVideoToIdea(youtubeVideoId, ideaId)

  if (!loadSettings().ruleAutoStatusOnLink) {
    return getIdeaById(ideaId)
  }

  const status = video ? computeAutoLinkedStatus(video) : 'published'
  return setIdeaLinkedStatus(
    ideaId,
    status,
    video?.publishedAt ? video.publishedAt.slice(0, 10) : null
  )
}

export function unlinkVideo(youtubeVideoId: string): void {
  dbUnlinkVideo(youtubeVideoId)
}

export function setVideoTags(youtubeVideoId: string, tagIds: number[]): void {
  const publishedVideoId = getPublishedVideoIdByYoutubeId(youtubeVideoId)
  if (publishedVideoId === null) throw new Error('Vidéo introuvable.')
  setPublishedVideoTags(publishedVideoId, tagIds)
}
