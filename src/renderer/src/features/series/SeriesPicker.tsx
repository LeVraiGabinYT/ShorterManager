import { useState, type ReactElement } from 'react'
import type { Series } from '@shared/types'

interface SeriesPickerProps {
  series: Series[]
  value: number | null
  onChange: (seriesId: number | null) => void
  onSeriesChanged: () => Promise<void>
}

export function SeriesPicker({
  series,
  value,
  onChange,
  onSeriesChanged
}: SeriesPickerProps): ReactElement {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  async function handleCreate(): Promise<void> {
    const name = newName.trim()
    if (!name) return
    const created = await window.api.series.create(name)
    await onSeriesChanged()
    onChange(created.id)
    setNewName('')
    setCreating(false)
  }

  if (creating) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreate()
            }
            if (e.key === 'Escape') setCreating(false)
          }}
          placeholder="Nom de la série"
          className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-md bg-blue-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-blue-500"
        >
          Créer
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
      >
        <option value="" className="bg-[#15161a]">
          Aucune
        </option>
        {series.map((s) => (
          <option key={s.id} value={s.id} className="bg-[#15161a]">
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="shrink-0 rounded-md border border-dashed border-white/20 px-2.5 py-2 text-xs text-gray-500 hover:border-white/40 hover:text-gray-300"
      >
        + Nouvelle
      </button>
    </div>
  )
}
