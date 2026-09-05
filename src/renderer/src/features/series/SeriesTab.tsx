import { useMemo, useState, type ReactElement } from 'react'
import type { Series, VideoIdea } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { toIdeaInput } from '../../lib/ideaInput'
import { formatDate } from '../../lib/format'

function SeriesRow({
  series,
  ideas,
  onRename,
  onDelete,
  onRemoveIdea
}: {
  series: Series
  ideas: VideoIdea[]
  onRename: (name: string) => void
  onDelete: () => void
  onRemoveIdea: (idea: VideoIdea) => void
}): ReactElement {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(series.name)
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function handleSave(): void {
    const trimmed = name.trim()
    if (trimmed && trimmed !== series.name) onRename(trimmed)
    else setName(series.name)
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') {
                  setName(series.name)
                  setEditing(false)
                }
              }}
              className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-gray-100 outline-none focus:border-blue-500/60"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-gray-100 hover:underline"
            >
              {series.name}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 text-xs text-gray-500">
          <span>
            {ideas.length} idée{ideas.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="hover:text-gray-300"
          >
            {expanded ? 'Réduire' : 'Détails'}
          </button>
          {confirmingDelete ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-red-600 px-2 py-0.5 font-medium text-white hover:bg-red-500"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="hover:text-red-300"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-1">
          {ideas.length === 0 ? (
            <p className="text-xs text-gray-600">Aucune idée dans cette série pour l’instant.</p>
          ) : (
            ideas.map((idea) => (
              <div
                key={idea.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
              >
                <span className="truncate">
                  {idea.emoji && <span className="mr-1.5">{idea.emoji}</span>}
                  {idea.title} · {formatDate(idea.publishDate)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveIdea(idea)}
                  className="shrink-0 text-gray-500 hover:text-red-300"
                >
                  Retirer
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function SeriesTab(): ReactElement {
  const { ideas, series, loading, refresh } = useIdeasData()
  const [newName, setNewName] = useState('')

  const ideasBySeriesId = useMemo(() => {
    const map = new Map<number, VideoIdea[]>()
    for (const idea of ideas) {
      if (idea.seriesId === null) continue
      const list = map.get(idea.seriesId) ?? []
      list.push(idea)
      map.set(idea.seriesId, list)
    }
    return map
  }, [ideas])

  async function handleCreate(): Promise<void> {
    const trimmed = newName.trim()
    if (!trimmed) return
    await window.api.series.create(trimmed)
    setNewName('')
    await refresh()
  }

  async function handleRename(s: Series, name: string): Promise<void> {
    await window.api.series.rename(s.id, name)
    await refresh()
  }

  async function handleDelete(s: Series): Promise<void> {
    await window.api.series.remove(s.id)
    await refresh()
  }

  async function handleRemoveIdea(idea: VideoIdea): Promise<void> {
    await window.api.ideas.update(idea.id, { ...toIdeaInput(idea), seriesId: null })
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Séries</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreate()
          }}
          className="mb-4 flex gap-2"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de la nouvelle série..."
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            + Nouvelle série
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : series.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune série pour l’instant.</p>
        ) : (
          <div className="space-y-2">
            {series.map((s) => (
              <SeriesRow
                key={s.id}
                series={s}
                ideas={ideasBySeriesId.get(s.id) ?? []}
                onRename={(name) => handleRename(s, name)}
                onDelete={() => handleDelete(s)}
                onRemoveIdea={handleRemoveIdea}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
