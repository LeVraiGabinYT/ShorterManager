import type { YouTubeVideoMeta } from '../../shared/types'

function extractYouTubeVideoId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = parsed.hostname.replace(/^www\.|^m\./, '')

  if (host === 'youtu.be') {
    return parsed.pathname.slice(1).split('/')[0] || null
  }

  if (host === 'youtube.com') {
    if (parsed.pathname.startsWith('/shorts/')) {
      return parsed.pathname.split('/')[2] || null
    }
    if (parsed.pathname.startsWith('/embed/')) {
      return parsed.pathname.split('/')[2] || null
    }
    if (parsed.pathname === '/watch') {
      return parsed.searchParams.get('v')
    }
  }

  return null
}

// Resolves a pasted Short/long-video link into a title + thumbnail via YouTube's public oEmbed
// endpoint — no API key or OAuth needed, deliberately separate from the channel's own OAuth-backed
// YouTube Data API integration in youtube/videos.ts (that one only ever touches the connected
// channel's own videos). Returns null for anything that isn't a real, resolvable YouTube link, so
// the caller never overwrites a card's title/thumbnail with garbage from an invalid URL.
export async function fetchYouTubeVideoMeta(url: string): Promise<YouTubeVideoMeta | null> {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) return null

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`
    const response = await fetch(oembedUrl)
    if (!response.ok) return null

    const data = (await response.json()) as { title?: string; thumbnail_url?: string }
    if (!data.title) return null

    return {
      title: data.title,
      thumbnailUrl: data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    }
  } catch {
    return null
  }
}
