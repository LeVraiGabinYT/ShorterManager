import { useMemo, useState, type ReactElement } from 'react'
import type { TaskType } from '@shared/types'

interface TaskTypePickerProps {
  taskTypes: TaskType[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
  onTaskTypesChanged: () => void
}

export function TaskTypePicker({
  taskTypes,
  selectedIds,
  onChange,
  onTaskTypesChanged
}: TaskTypePickerProps): ReactElement {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📌')
  const [query, setQuery] = useState('')

  const visibleTypes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return taskTypes
    return taskTypes.filter(
      (type) => selectedIds.includes(type.id) || type.name.toLowerCase().includes(q)
    )
  }, [taskTypes, query, selectedIds])

  function toggle(id: number): void {
    onChange(selectedIds.includes(id) ? selectedIds.filter((t) => t !== id) : [...selectedIds, id])
  }

  async function handleCreate(): Promise<void> {
    const name = newName.trim()
    if (!name) return
    const type = await window.api.taskTypes.create({ name, emoji: newEmoji.trim() || '📌' })
    onTaskTypesChanged()
    onChange([...selectedIds, type.id])
    setNewName('')
    setNewEmoji('📌')
    setCreating(false)
  }

  return (
    <div className="space-y-1.5">
      {taskTypes.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un type de tâche..."
          className="w-full max-w-xs rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
        />
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {visibleTypes.map((type) => {
          const selected = selectedIds.includes(type.id)
          return (
            <button
              type="button"
              key={type.id}
              onClick={() => toggle(type.id)}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                selected
                  ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                  : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {type.emoji} {type.name}
            </button>
          )
        })}

        {creating ? (
          <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 p-1.5">
            <input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              className="w-8 bg-transparent text-center text-sm outline-none"
            />
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
              placeholder="Nom du type"
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
            className="rounded-md border border-dashed border-white/20 px-2 py-1 text-xs text-gray-500 hover:border-white/40 hover:text-gray-300"
          >
            + Nouveau type
          </button>
        )}
      </div>
    </div>
  )
}
