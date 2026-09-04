import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { ChannelStatus, PublishedVideo } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { ChannelVideoDetailModal } from './ChannelVideoDetailModal'
import { ChannelVideoRow } from './ChannelVideoRow'

export function ChannelTab(): ReactElement {
  const { ideas, tags, tagsById, publishedVideos, refresh: refreshIdeasData } = useIdeasData()
  const [status, setStatus] = useState<ChannelStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<PublishedVideo | null>(null)

  useEffect(() => {
    window.api.channel.getStatus().then(setStatus)
  }, [])

  const ideasById = useMemo(() => new Map(ideas.map((idea) => [idea.id, idea])), [ideas])
  const unlinkedIdeas = useMemo(
    () => ideas.filter((idea) => !publishedVideos.some((v) => v.ideaId === idea.id)),
    [ideas, publishedVideos]
  )

  async function handleConnect(): Promise<void> {
    setConnecting(true)
    setError(null)
    const result = await window.api.channel.connect()
    setConnecting(false)
    if (result.success) {
      setStatus(result.status)
    } else {
      setError(result.error ?? 'Échec de la connexion.')
    }
  }

  async function handleDisconnect(): Promise<void> {
    await window.api.channel.disconnect()
    setStatus(await window.api.channel.getStatus())
  }

  async function handleRefreshVideos(): Promise<void> {
    setRefreshing(true)
    setError(null)
    const result = await window.api.channel.refreshVideos()
    if (result.error) setError(result.error)
    setRefreshing(false)
    await refreshIdeasData()
  }

  async function handleAddToList(video: PublishedVideo): Promise<void> {
    await window.api.channel.createIdeaFromVideo(video.youtubeVideoId)
    setSelectedVideo(null)
    await refreshIdeasData()
  }

  async function handleLinkToIdea(video: PublishedVideo, ideaId: number): Promise<void> {
    await window.api.channel.linkVideoToIdea(video.youtubeVideoId, ideaId)
    setSelectedVideo(null)
    await refreshIdeasData()
  }

  async function handleUnlink(video: PublishedVideo): Promise<void> {
    await window.api.channel.unlinkVideo(video.youtubeVideoId)
    setSelectedVideo(null)
    await refreshIdeasData()
  }

  async function handleSetTags(video: PublishedVideo, tagIds: number[]): Promise<void> {
    await window.api.channel.setVideoTags(video.youtubeVideoId, tagIds)
    await refreshIdeasData()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Chaîne YouTube</h1>
        {status?.connected && (
          <button
            onClick={handleRefreshVideos}
            disabled={refreshing}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? 'Actualisation...' : 'Actualiser les vidéos'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-gray-300">
                Connecté à <span className="font-medium text-gray-100">{status.channelTitle}</span>
              </p>
              <button
                onClick={handleDisconnect}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Déconnecter
              </button>
            </div>

            {error && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            {publishedVideos.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucune vidéo récupérée pour l’instant. Clique sur « Actualiser les vidéos ».
              </p>
            ) : (
              <div className="space-y-2">
                {publishedVideos.map((video) => (
                  <ChannelVideoRow
                    key={video.youtubeVideoId}
                    video={video}
                    linkedIdea={video.ideaId ? (ideasById.get(video.ideaId) ?? null) : null}
                    tagsById={tagsById}
                    onClick={() => setSelectedVideo(video)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-6">
            <p className="text-sm text-gray-300">
              Connecte ta chaîne YouTube (Google OAuth) pour récupérer tes vidéos publiées, leurs
              statistiques, et pouvoir les comparer aux idées de la liste. La connexion se fait en
              une seule fois.
            </p>

            {error && (
              <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting}
              className="mt-5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting
                ? 'Connexion en cours (vérifie ton navigateur)...'
                : 'Connecter ma chaîne YouTube'}
            </button>
          </div>
        )}
      </div>

      {selectedVideo && (
        <ChannelVideoDetailModal
          video={selectedVideo}
          linkedIdea={selectedVideo.ideaId ? (ideasById.get(selectedVideo.ideaId) ?? null) : null}
          unlinkedIdeas={unlinkedIdeas}
          tags={tags}
          onClose={() => setSelectedVideo(null)}
          onAddToList={() => handleAddToList(selectedVideo)}
          onLinkToIdea={(ideaId) => handleLinkToIdea(selectedVideo, ideaId)}
          onUnlink={() => handleUnlink(selectedVideo)}
          onSetTags={(tagIds) => handleSetTags(selectedVideo, tagIds)}
          onTagsChanged={refreshIdeasData}
        />
      )}
    </div>
  )
}
