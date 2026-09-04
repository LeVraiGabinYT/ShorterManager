import { useMemo, useState, type ReactElement } from 'react'
import type { IdeaStatus, VideoIdea, VideoIdeaInput } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { DEFAULT_IDEA_FILTERS, filterIdeas, type IdeaFiltersState } from '../../lib/ideaFilters'
import { BulkActionsBar } from './BulkActionsBar'
import { IdeaCard } from './IdeaCard'
import { IdeaFilters } from './IdeaFilters'
import { IdeaFormModal } from './IdeaFormModal'

function toIdeaInput(idea: VideoIdea): VideoIdeaInput {
  return {
    title: idea.title,
    emoji: idea.emoji,
    description: idea.description,
    status: idea.status,
    publishDate: idea.publishDate,
    shootDate: idea.shootDate,
    objectIds: idea.objectIds,
    tagIds: idea.tagIds
  }
}

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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

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

  function toggleSelect(ideaId: number): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(ideaId)) next.delete(ideaId)
      else next.add(ideaId)
      return next
    })
  }

  const selectedIdeas = ideas.filter((idea) => selectedIds.has(idea.id))

  async function handleBulkAddTag(tagId: number): Promise<void> {
    await Promise.all(
      selectedIdeas
        .filter((idea) => !idea.tagIds.includes(tagId))
        .map((idea) =>
          window.api.ideas.update(idea.id, {
            ...toIdeaInput(idea),
            tagIds: [...idea.tagIds, tagId]
          })
        )
    )
    await refresh()
  }

  async function handleBulkAddObject(objectId: number): Promise<void> {
    await Promise.all(
      selectedIdeas
        .filter((idea) => !idea.objectIds.includes(objectId))
        .map((idea) =>
          window.api.ideas.update(idea.id, {
            ...toIdeaInput(idea),
            objectIds: [...idea.objectIds, objectId]
          })
        )
    )
    await refresh()
  }

  async function handleBulkSetStatus(status: IdeaStatus): Promise<void> {
    await Promise.all(
      selectedIdeas.map((idea) =>
        window.api.ideas.update(idea.id, { ...toIdeaInput(idea), status })
      )
    )
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

      <div className="space-y-3 px-6 pb-4">
        <IdeaFilters filters={filters} onChange={setFilters} tags={tags} objects={objects} />
        {selectedIds.size > 0 && (
          <BulkActionsBar
            selectedCount={selectedIds.size}
            tags={tags}
            objects={objects}
            onAddTag={handleBulkAddTag}
            onAddObject={handleBulkAddObject}
            onSetStatus={handleBulkSetStatus}
            onClear={() => setSelectedIds(new Set())}
          />
        )}
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
          <>
            <label className="mb-2 flex items-center gap-2 px-1 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={filteredIdeas.every((i) => selectedIds.has(i.id))}
                onChange={(e) =>
                  setSelectedIds(
                    e.target.checked ? new Set(filteredIdeas.map((i) => i.id)) : new Set()
                  )
                }
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-600"
              />
              Tout sélectionner ({filteredIdeas.length})
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredIdeas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  objectsById={objectsById}
                  tagsById={tagsById}
                  selected={selectedIds.has(idea.id)}
                  onToggleSelect={() => toggleSelect(idea.id)}
                  onClick={() => setEditingIdea(idea)}
                />
              ))}
            </div>
          </>
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
