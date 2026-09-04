import { useState, type FormEvent, type ReactElement } from 'react'
import { IDEA_STATUSES } from '@shared/types'
import type { OwnedObject, VideoIdea, VideoIdeaInput } from '@shared/types'
import { toDateInputValue } from '../../lib/format'

interface IdeaFormModalProps {
  idea: VideoIdea | null
  objects: OwnedObject[]
  onClose: () => void
  onSave: (input: VideoIdeaInput) => void
  onDelete?: () => void
}

export function IdeaFormModal({
  idea,
  objects,
  onClose,
  onSave,
  onDelete
}: IdeaFormModalProps): ReactElement {
  const [title, setTitle] = useState(idea?.title ?? '')
  const [description, setDescription] = useState(idea?.description ?? '')
  const [status, setStatus] = useState<VideoIdeaInput['status']>(idea?.status ?? 'idea')
  const [publishDate, setPublishDate] = useState(toDateInputValue(idea?.publishDate ?? null))
  const [shootDate, setShootDate] = useState(toDateInputValue(idea?.shootDate ?? null))
  const [objectIds, setObjectIds] = useState<number[]>(idea?.objectIds ?? [])

  function toggleObject(id: number): void {
    setObjectIds((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]))
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim() || null,
      status,
      publishDate: publishDate || null,
      shootDate: shootDate || null,
      objectIds
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border border-white/10 bg-[#15161a] p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold text-gray-100">
          {idea ? "Modifier l'idée" : 'Nouvelle idée'}
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Titre</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
              placeholder="Titre de la vidéo"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Description <span className="text-gray-600">(non visible dans la liste)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 resize-none"
              placeholder="Notes, script, angle de la vidéo..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Statut</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VideoIdeaInput['status'])}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
              >
                {IDEA_STATUSES.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#15161a]">
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div />

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Date de tournage
              </label>
              <input
                type="date"
                value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Date de publication
              </label>
              <input
                type="date"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Objets nécessaires
            </label>
            {objects.length === 0 ? (
              <p className="text-xs text-gray-600">
                Aucun objet enregistré pour l’instant (onglet « Objets achetés »).
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {objects.map((obj) => {
                  const selected = objectIds.includes(obj.id)
                  return (
                    <button
                      type="button"
                      key={obj.id}
                      onClick={() => toggleObject(obj.id)}
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        selected
                          ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {obj.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
              >
                Supprimer
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
