import { useMemo, useState, type ReactElement } from 'react'
import type { VideoIdea, VideoIdeaInput } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { DEFAULT_IDEA_FILTERS, filterIdeas, type IdeaFiltersState } from '../../lib/ideaFilters'
import { IdeaCard } from './IdeaCard'
import { IdeaFilters } from './IdeaFilters'
import { IdeaFormModal } from './IdeaFormModal'

export function IdeasTab(): ReactElement {
  const {
    ideas,
    objects,
    objectsById,
    tags,
    tagsById,
    publishedVideos,
    publishedVideosByIdeaId,
    loading,
    refresh
  } = useIdeasData()
  const [editingIdea, setEditingIdea] = useState<VideoIdea | null>(null)
  const [creating, setCreating] = useState(false)
  const [filters, setFilters] = useState<IdeaFiltersState>(DEFAULT_IDEA_FILTERS)

  const filteredIdeas = useMemo(
    () => filterIdeas(ideas, filters, objectsById),
    [ideas, filters, objectsById]
  )
  const unlinkedVideos = useMemo(
    () => publishedVideos.filter((v) => v.ideaId === null),
    [publishedVideos]
  )

  async function handleCreate(input: VideoIdeaInput): Promise<void> {
    await window.api.ideas.create(input)
    setCreating(false)
    await refresh()
  }

  async function handleUpdate(input: VideoIdeaInput): Promise<void> {
    if (!editingIdea) return
    await window.api.ideas.update(editingIdea.id, input)
    setEditingIdea(null)
    await refresh()
  }

  async function handleDelete(): Promise<void> {
    if (!editingIdea) return
    await window.api.ideas.remove(editingIdea.id)
    setEditingIdea(null)
    await refresh()
  }

  async function handleLinkVideo(youtubeVideoId: string): Promise<void> {
    if (!editingIdea) return
    await window.api.channel.linkVideoToIdea(youtubeVideoId, editingIdea.id)
    await refresh()
  }

  async function handleUnlinkVideo(): Promise<void> {
    const linkedVideo = editingIdea ? publishedVideosByIdeaId.get(editingIdea.id) : null
    if (!linkedVideo) return
    await window.api.channel.unlinkVideo(linkedVideo.youtubeVideoId)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Idées de vidéos</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Nouvelle idée
        </button>
      </div>

      <div className="px-6 pb-4">
        <IdeaFilters filters={filters} onChange={setFilters} tags={tags} objects={objects} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : ideas.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune idée pour l’instant. Clique sur « Nouvelle idée » pour commencer.
          </p>
        ) : filteredIdeas.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune idée ne correspond à ces filtres.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                objectsById={objectsById}
                tagsById={tagsById}
                onClick={() => setEditingIdea(idea)}
              />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <IdeaFormModal
          idea={null}
          objects={objects}
          tags={tags}
          linkedVideo={null}
          unlinkedVideos={unlinkedVideos}
          onClose={() => setCreating(false)}
          onSave={handleCreate}
          onTagsChanged={refresh}
          onLinkVideo={() => {}}
          onUnlinkVideo={() => {}}
        />
      )}

      {editingIdea && (
        <IdeaFormModal
          idea={editingIdea}
          objects={objects}
          tags={tags}
          linkedVideo={publishedVideosByIdeaId.get(editingIdea.id) ?? null}
          unlinkedVideos={unlinkedVideos}
          onClose={() => setEditingIdea(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
          onTagsChanged={refresh}
          onLinkVideo={handleLinkVideo}
          onUnlinkVideo={handleUnlinkVideo}
        />
      )}
    </div>
  )
}
