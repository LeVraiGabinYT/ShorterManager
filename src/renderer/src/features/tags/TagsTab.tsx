import { useEffect, useState, type ReactElement } from 'react'
import { TAG_COLOR_PRESETS } from '@shared/types'
import type { Tag } from '@shared/types'
import { getTagChipStyle } from '../../lib/tagColors'

function TagRow({
  tag,
  onRename,
  onColorChange,
  onDelete
}: {
  tag: Tag
  onRename: (name: string) => void
  onColorChange: (color: string) => void
  onDelete: () => void
}): ReactElement {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tag.name)
  const [pickingColor, setPickingColor] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function handleSave(): void {
    const trimmed = name.trim()
    if (trimmed && trimmed !== tag.name) onRename(trimmed)
    else setName(tag.name)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickingColor((v) => !v)}
          style={{ backgroundColor: tag.color }}
          className="h-6 w-6 shrink-0 rounded-full ring-1 ring-white/20"
          aria-label="Changer la couleur"
        />
        {pickingColor && (
          <div className="absolute left-0 top-8 z-10 flex gap-1 rounded-md border border-white/10 bg-[#1c1d22] p-2 shadow-xl">
            {TAG_COLOR_PRESETS.map((color) => (
              <button
                type="button"
                key={color}
                onClick={() => {
                  onColorChange(color)
                  setPickingColor(false)
                }}
                style={{ backgroundColor: color }}
                className={`h-5 w-5 rounded-full ${
                  tag.color === color ? 'ring-2 ring-white/80' : ''
                }`}
                aria-label={color}
              />
            ))}
          </div>
        )}
      </div>

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
                setName(tag.name)
                setEditing(false)
              }
            }}
            className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-gray-100 outline-none focus:border-blue-500/60"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={getTagChipStyle(tag.color)}
            className="rounded-md border px-2 py-1 text-sm font-medium hover:underline"
          >
            {tag.name}
          </button>
        )}
      </div>

      {confirmingDelete ? (
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="text-red-300">Supprimer ce tag ?</span>
          <button
            type="button"
            onClick={onDelete}
            className="rounded bg-red-600 px-2 py-0.5 font-medium text-white hover:bg-red-500"
          >
            Oui
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="text-gray-400 hover:text-gray-200"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="shrink-0 text-xs text-gray-500 hover:text-red-300"
        >
          Supprimer
        </button>
      )}
    </div>
  )
}

export function TagsTab(): ReactElement {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')

  async function refresh(): Promise<void> {
    const list = await window.api.tags.list()
    setTags(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(): Promise<void> {
    const trimmed = newName.trim()
    if (!trimmed) return
    const color = TAG_COLOR_PRESETS[Math.floor(Math.random() * TAG_COLOR_PRESETS.length)]
    await window.api.tags.create({ name: trimmed, color })
    setNewName('')
    await refresh()
  }

  async function handleRename(tag: Tag, name: string): Promise<void> {
    await window.api.tags.update(tag.id, { name, color: tag.color })
    await refresh()
  }

  async function handleColorChange(tag: Tag, color: string): Promise<void> {
    await window.api.tags.update(tag.id, { name: tag.name, color })
    await refresh()
  }

  async function handleDelete(tag: Tag): Promise<void> {
    await window.api.tags.remove(tag.id)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Tags</h1>
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
            placeholder="Nom du nouveau tag..."
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            + Nouveau tag
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun tag pour l’instant.</p>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                onRename={(name) => handleRename(tag, name)}
                onColorChange={(color) => handleColorChange(tag, color)}
                onDelete={() => handleDelete(tag)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
