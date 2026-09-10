import { useMemo, useState, type ReactElement } from 'react'
import type { OwnedObject } from '@shared/types'

interface ObjectPickerProps {
  objects: OwnedObject[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

export function ObjectPicker({ objects, selectedIds, onChange }: ObjectPickerProps): ReactElement {
  const [query, setQuery] = useState('')

  const visibleObjects = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return objects
    // Keep already-selected objects visible even if they no longer match the search, so the
    // current selection never silently disappears while typing.
    return objects.filter(
      (obj) => selectedIds.includes(obj.id) || obj.name.toLowerCase().includes(q)
    )
  }, [objects, query, selectedIds])

  function toggle(id: number): void {
    onChange(selectedIds.includes(id) ? selectedIds.filter((o) => o !== id) : [...selectedIds, id])
  }

  return (
    <div className="space-y-1.5">
      {objects.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un objet..."
          className="w-full max-w-xs rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {visibleObjects.map((obj) => {
          const selected = selectedIds.includes(obj.id)
          return (
            <button
              type="button"
              key={obj.id}
              onClick={() => toggle(obj.id)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                selected
                  ? obj.purchased
                    ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                    : 'border-red-500/50 bg-red-500/20 text-red-300'
                  : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {obj.name}
              {!obj.purchased && ' (non acheté)'}
            </button>
          )
        })}
        {objects.length > 0 && visibleObjects.length === 0 && (
          <p className="text-xs text-gray-600">Aucun objet ne correspond.</p>
        )}
      </div>
    </div>
  )
}
