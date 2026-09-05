import { useMemo, useState, type ReactElement } from 'react'
import type { Tag } from '@shared/types'
import { getTagChipStyle, randomTagColor } from '../../lib/tagColors'

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
  const [query, setQuery] = useState('')

  const visibleTags = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tags
    // Keep already-selected tags visible even if they no longer match the search, so the
    // current selection never silently disappears while typing.
    return tags.filter((tag) => selectedIds.includes(tag.id) || tag.name.toLowerCase().includes(q))
  }, [tags, query, selectedIds])

  function toggle(id: number): void {
    onChange(selectedIds.includes(id) ? selectedIds.filter((t) => t !== id) : [...selectedIds, id])
  }

  async function handleCreate(): Promise<void> {
    const name = newName.trim()
    if (!name) return
    const tag = await window.api.tags.create({ name, color: randomTagColor() })
    onTagsChanged()
    onChange([...selectedIds, tag.id])
    setNewName('')
    setCreating(false)
  }

  return (
    <div className="space-y-1.5">
      {tags.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un tag..."
          className="w-full max-w-xs rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
        />
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {visibleTags.map((tag) => {
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
    </div>
  )
}
