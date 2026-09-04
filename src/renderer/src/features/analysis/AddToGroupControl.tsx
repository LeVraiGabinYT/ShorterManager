import { useState, type ReactElement } from 'react'
import type { AnalysisGroup } from '@shared/types'
import { SearchablePicker } from '../../components/SearchablePicker'

interface AddToGroupControlProps {
  groups: AnalysisGroup[]
  selectedVideoIds: string[]
  onAdded: () => Promise<void>
}

export function AddToGroupControl({
  groups,
  selectedVideoIds,
  onAdded
}: AddToGroupControlProps): ReactElement {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  async function handleAddToExisting(group: AnalysisGroup): Promise<void> {
    await window.api.analysisGroups.addVideos(group.id, selectedVideoIds)
    await onAdded()
  }

  async function handleCreateAndAdd(): Promise<void> {
    const name = newName.trim()
    if (!name) return
    const group = await window.api.analysisGroups.create(name)
    await window.api.analysisGroups.addVideos(group.id, selectedVideoIds)
    setNewName('')
    setCreating(false)
    await onAdded()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-64">
        <SearchablePicker
          items={groups}
          getKey={(g) => g.id}
          getLabel={(g) => g.name}
          onSelect={handleAddToExisting}
          placeholder="Ajouter à un groupe existant..."
          emptyLabel="Aucun groupe pour l'instant."
        />
      </div>
      {creating ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreateAndAdd()
              }
              if (e.key === 'Escape') setCreating(false)
            }}
            placeholder="Nom du groupe"
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
          />
          <button
            type="button"
            onClick={handleCreateAndAdd}
            className="rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Créer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md border border-dashed border-white/20 px-2.5 py-1.5 text-sm text-gray-500 hover:border-white/40 hover:text-gray-300"
        >
          + Nouveau groupe
        </button>
      )}
    </div>
  )
}
