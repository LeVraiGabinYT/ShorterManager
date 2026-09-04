import { useEffect, useState, type ReactElement } from 'react'
import type { OwnedObject, OwnedObjectInput } from '@shared/types'
import { formatDate, formatPrice } from '../../lib/format'
import { ObjectFormModal } from './ObjectFormModal'

export function ObjectsTab(): ReactElement {
  const [objects, setObjects] = useState<OwnedObject[]>([])
  const [loading, setLoading] = useState(true)
  const [editingObject, setEditingObject] = useState<OwnedObject | null>(null)
  const [creating, setCreating] = useState(false)

  async function refresh(): Promise<void> {
    const list = await window.api.objects.list()
    setObjects(list)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate(input: OwnedObjectInput): Promise<void> {
    await window.api.objects.create(input)
    setCreating(false)
    await refresh()
  }

  async function handleUpdate(input: OwnedObjectInput): Promise<void> {
    if (!editingObject) return
    await window.api.objects.update(editingObject.id, input)
    setEditingObject(null)
    await refresh()
  }

  async function handleDelete(): Promise<void> {
    if (!editingObject) return
    await window.api.objects.remove(editingObject.id)
    setEditingObject(null)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Objets achetés</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Nouvel objet
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : objects.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun objet enregistré pour l’instant.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {objects.map((obj) => (
              <button
                key={obj.id}
                onClick={() => setEditingObject(obj)}
                className="w-full text-left rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium text-gray-100 leading-snug">{obj.name}</h3>
                  <span className="shrink-0 text-sm text-gray-300">{formatPrice(obj.price)}</span>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Acheté le {formatDate(obj.purchaseDate)}
                </div>
                {obj.description && (
                  <p className="mt-2 text-xs text-gray-500 line-clamp-2">{obj.description}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {creating && (
        <ObjectFormModal object={null} onClose={() => setCreating(false)} onSave={handleCreate} />
      )}

      {editingObject && (
        <ObjectFormModal
          object={editingObject}
          onClose={() => setEditingObject(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
