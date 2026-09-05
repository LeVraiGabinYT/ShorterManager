import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import type { ChannelStatus, PublishedVideo, VideoIdea } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { toIdeaInput } from '../../lib/ideaInput'
import { BulkDuplicateModal, type BulkAddPlan } from './BulkDuplicateModal'
import { ChannelBulkAddControl } from './ChannelBulkAddControl'
import { ChannelVideoDetailModal } from './ChannelVideoDetailModal'
import { ChannelVideoRow } from './ChannelVideoRow'
import { DuplicateIdeaModal } from './DuplicateIdeaModal'

export function ChannelTab(): ReactElement {
  const {
    ideas,
    objects,
    tags,
    tagsById,
    series,
    publishedVideos,
    refresh: refreshIdeasData
  } = useIdeasData()
  const [status, setStatus] = useState<ChannelStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<PublishedVideo | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PublishedVideo[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [duplicateCheck, setDuplicateCheck] = useState<{
    video: PublishedVideo
    existingIdea: VideoIdea
  } | null>(null)
  const [bulkDuplicate, setBulkDuplicate] = useState<{
    plans: BulkAddPlan[]
    tagIds: number[]
    objectIds: number[]
    seriesId: number | null
    emoji: string
  } | null>(null)

  useEffect(() => {
    window.api.channel.getStatus().then(setStatus)
  }, [])

  const ideasById = useMemo(() => new Map(ideas.map((idea) => [idea.id, idea])), [ideas])
  const unlinkedIdeas = useMemo(
    () => ideas.filter((idea) => !publishedVideos.some((v) => v.ideaId === idea.id)),
    [ideas, publishedVideos]
  )
  const videosToShow = searchResults ?? publishedVideos

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

  function findDuplicateIdea(video: PublishedVideo): VideoIdea | null {
    const title = video.title?.trim()
    if (!title) return null
    return ideas.find((idea) => idea.title.trim() === title) ?? null
  }

  function handleAddToList(video: PublishedVideo): void {
    const existingIdea = findDuplicateIdea(video)
    if (existingIdea) {
      setDuplicateCheck({ video, existingIdea })
      return
    }
    createNewIdeaFromVideo(video)
  }

  async function createNewIdeaFromVideo(video: PublishedVideo): Promise<void> {
    await window.api.channel.createIdeaFromVideo(video.youtubeVideoId)
    setSelectedVideo(null)
    setDuplicateCheck(null)
    await refreshIdeasData()
  }

  async function mergeIntoExistingIdea(
    video: PublishedVideo,
    existingIdea: VideoIdea
  ): Promise<void> {
    await window.api.channel.linkVideoToIdea(video.youtubeVideoId, existingIdea.id)
    setSelectedVideo(null)
    setDuplicateCheck(null)
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

  async function handleSearch(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchError(null)
    const result = await window.api.channel.searchVideos(searchQuery.trim())
    setSearching(false)
    if (result.error) setSearchError(result.error)
    setSearchResults(result.videos)
    await refreshIdeasData()
  }

  function handleClearSearch(): void {
    setSearchQuery('')
    setSearchResults(null)
    setSearchError(null)
    setSelectedIds(new Set())
  }

  function toggleVideoSelection(youtubeVideoId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(youtubeVideoId)) next.delete(youtubeVideoId)
      else next.add(youtubeVideoId)
      return next
    })
  }

  async function applyBulkPlans(
    plans: BulkAddPlan[],
    tagIds: number[],
    objectIds: number[],
    seriesId: number | null,
    emoji: string
  ): Promise<void> {
    for (const plan of plans) {
      const resultingIdea = plan.existingIdea
        ? await window.api.channel.linkVideoToIdea(plan.video.youtubeVideoId, plan.existingIdea.id)
        : await window.api.channel.createIdeaFromVideo(plan.video.youtubeVideoId)

      if (tagIds.length > 0 || objectIds.length > 0 || seriesId !== null || emoji !== '') {
        await window.api.ideas.update(resultingIdea.id, {
          ...toIdeaInput(resultingIdea),
          tagIds: Array.from(new Set([...resultingIdea.tagIds, ...tagIds])),
          objectIds: Array.from(new Set([...resultingIdea.objectIds, ...objectIds])),
          seriesId: seriesId ?? resultingIdea.seriesId,
          emoji: emoji || resultingIdea.emoji
        })
      }
    }

    setSelectedIds(new Set())
    setBulkDuplicate(null)
    await refreshIdeasData()
  }

  function handleBulkAdd(
    tagIds: number[],
    objectIds: number[],
    seriesId: number | null,
    emoji: string
  ): void {
    const plans: BulkAddPlan[] = [...selectedIds]
      .map((id) => videosToShow.find((v) => v.youtubeVideoId === id))
      .filter((v): v is PublishedVideo => v !== undefined)
      .map((video) => ({ video, existingIdea: findDuplicateIdea(video) }))

    if (plans.some((p) => p.existingIdea !== null)) {
      setBulkDuplicate({ plans, tagIds, objectIds, seriesId, emoji })
    } else {
      applyBulkPlans(plans, tagIds, objectIds, seriesId, emoji)
    }
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

            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Chercher une vidéo sur toute la chaîne (pas seulement les vidéos ci-dessous)..."
                className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
              />
              <button
                type="submit"
                disabled={searching}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searching ? 'Recherche...' : 'Chercher sur la chaîne'}
              </button>
              {searchResults !== null && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-sm text-gray-500 hover:text-gray-300"
                >
                  Réinitialiser
                </button>
              )}
            </form>

            {searchError && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {searchError}
              </p>
            )}

            {searchResults !== null && (
              <p className="text-xs text-gray-500">
                {searchResults.length} résultat{searchResults.length > 1 ? 's' : ''} pour «{' '}
                {searchQuery} » sur la chaîne
              </p>
            )}

            {selectedIds.size > 0 && (
              <ChannelBulkAddControl
                selectedCount={selectedIds.size}
                tags={tags}
                objects={objects}
                series={series}
                onAdd={handleBulkAdd}
                onTagsChanged={refreshIdeasData}
                onSeriesChanged={refreshIdeasData}
              />
            )}

            {videosToShow.length === 0 ? (
              <p className="text-sm text-gray-500">
                {searchResults !== null
                  ? 'Aucune vidéo trouvée.'
                  : 'Aucune vidéo récupérée pour l’instant. Clique sur « Actualiser les vidéos ».'}
              </p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 px-1 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={videosToShow.every((v) => selectedIds.has(v.youtubeVideoId))}
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked
                          ? new Set(videosToShow.map((v) => v.youtubeVideoId))
                          : new Set()
                      )
                    }
                    className="h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-600"
                  />
                  Tout sélectionner ({videosToShow.length})
                </label>
                {videosToShow.map((video) => (
                  <div key={video.youtubeVideoId} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(video.youtubeVideoId)}
                      onChange={() => toggleVideoSelection(video.youtubeVideoId)}
                      className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-blue-600"
                    />
                    <div className="min-w-0 flex-1">
                      <ChannelVideoRow
                        video={video}
                        linkedIdea={video.ideaId ? (ideasById.get(video.ideaId) ?? null) : null}
                        tagsById={tagsById}
                        onClick={() => setSelectedVideo(video)}
                      />
                    </div>
                  </div>
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

      {duplicateCheck && (
        <DuplicateIdeaModal
          video={duplicateCheck.video}
          existingIdea={duplicateCheck.existingIdea}
          tagsById={tagsById}
          onMerge={() => mergeIntoExistingIdea(duplicateCheck.video, duplicateCheck.existingIdea)}
          onCreateNew={() => createNewIdeaFromVideo(duplicateCheck.video)}
          onCancel={() => setDuplicateCheck(null)}
        />
      )}

      {bulkDuplicate && (
        <BulkDuplicateModal
          plans={bulkDuplicate.plans}
          onCancel={() => setBulkDuplicate(null)}
          onAddNewOnly={() =>
            applyBulkPlans(
              bulkDuplicate.plans.filter((p) => p.existingIdea === null),
              bulkDuplicate.tagIds,
              bulkDuplicate.objectIds,
              bulkDuplicate.seriesId,
              bulkDuplicate.emoji
            )
          }
          onMergeAndAddAll={() =>
            applyBulkPlans(
              bulkDuplicate.plans,
              bulkDuplicate.tagIds,
              bulkDuplicate.objectIds,
              bulkDuplicate.seriesId,
              bulkDuplicate.emoji
            )
          }
        />
      )}
    </div>
  )
}
