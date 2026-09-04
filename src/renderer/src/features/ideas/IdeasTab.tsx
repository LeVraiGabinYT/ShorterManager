import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { OwnedObject, VideoIdea, VideoIdeaInput } from '@shared/types'
import { IdeaCard } from './IdeaCard'
import { IdeaFormModal } from './IdeaFormModal'

export function IdeasTab(): ReactElement {
  const [ideas, setIdeas] = useState<VideoIdea[]>([])
  const [objects, setObjects] = useState<OwnedObject[]>([])
  const [loading, setLoading] = useState(true)
  const [editingIdea, setEditingIdea] = useState<VideoIdea | null>(null)
  const [creating, setCreating] = useState(false)

  async function refresh(): Promise<void> {
    const [ideasList, objectsList] = await Promise.all([
      window.api.ideas.list(),
      window.api.objects.list()
    ])
    setIdeas(ideasList)
    setObjects(objectsList)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const objectsById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects])

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

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : ideas.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune idée pour l’instant. Clique sur « Nouvelle idée » pour commencer.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                objectsById={objectsById}
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
          onClose={() => setCreating(false)}
          onSave={handleCreate}
        />
      )}

      {editingIdea && (
        <IdeaFormModal
          idea={editingIdea}
          objects={objects}
          onClose={() => setEditingIdea(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
