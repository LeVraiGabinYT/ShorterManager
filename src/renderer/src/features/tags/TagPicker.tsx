import { useState, type ReactElement } from 'react'
import { TAG_COLOR_PRESETS } from '@shared/types'
import type { Tag } from '@shared/types'
import { getTagChipStyle } from '../../lib/tagColors'

interface TagPickerProps {
  tags: Tag[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  onTagsChanged: () => void
}

export function TagPicker({
  tags,
  selectedIds,
  onChange,
  onTagsChanged
}: TagPickerProps): ReactElement {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(TAG_COLOR_PRESETS[0])

  function toggle(id: number): void {
    onChange(selectedIds.includes(id) ? selectedIds.filter((t) => t !== id) : [...selectedIds, id])
  }

  async function handleCreate(): Promise<void> {
    const name = newName.trim()
    if (!name) return
    const tag = await window.api.tags.create({ name, color: newColor })
    onTagsChanged()
    onChange([...selectedIds, tag.id])
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => {
        const selected = selectedIds.includes(tag.id)
        return (
          <button
            type="button"
            key={tag.id}
            onClick={() => toggle(tag.id)}
            style={selected ? getTagChipStyle(tag.color) : undefined}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              selected ? '' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {tag.name}
          </button>
        )
      })}

      {creating ? (
        <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 p-1.5">
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
            placeholder="Nom du tag"
            className="w-28 bg-transparent text-xs text-gray-100 outline-none placeholder:text-gray-600"
          />
          <div className="flex gap-1">
            {TAG_COLOR_PRESETS.map((color) => (
              <button
                type="button"
                key={color}
                onClick={() => setNewColor(color)}
                style={{ backgroundColor: color }}
                className={`h-4 w-4 rounded-full ${
                  newColor === color ? 'ring-2 ring-white/80' : ''
                }`}
                aria-label={color}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-500"
          >
            Ajouter
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md border border-dashed border-white/20 px-2 py-1 text-xs text-gray-500 hover:text-gray-300 hover:border-white/40"
        >
          + Nouveau tag
        </button>
      )}
    </div>
  )
}
