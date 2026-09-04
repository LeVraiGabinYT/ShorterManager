import { useState, type FormEvent, type ReactElement } from 'react'
import type { OwnedObject, OwnedObjectInput } from '@shared/types'
import { toDateInputValue } from '../../lib/format'

interface ObjectFormModalProps {
  object: OwnedObject | null
  onClose: () => void
  onSave: (input: OwnedObjectInput) => void
  onDelete?: () => void
}

export function ObjectFormModal({
  object,
  onClose,
  onSave,
  onDelete
}: ObjectFormModalProps): ReactElement {
  const [name, setName] = useState(object?.name ?? '')
  const [description, setDescription] = useState(object?.description ?? '')
  const [purchaseDate, setPurchaseDate] = useState(toDateInputValue(object?.purchaseDate ?? null))
  const [price, setPrice] = useState(object?.price?.toString() ?? '')
  const [link, setLink] = useState(object?.link ?? '')
  const [purchased, setPurchased] = useState(object?.purchased ?? false)

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      purchaseDate: purchaseDate || null,
      price: price.trim() ? Number(price) : null,
      link: link.trim() || null,
      purchased
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-white/10 bg-[#15161a] p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold text-gray-100">
          {object ? "Modifier l'objet" : 'Nouvel objet'}
        </h2>

        <div className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={purchased}
              onChange={(e) => setPurchased(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-600"
            />
            Acheté
          </label>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nom</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
              placeholder="Ex : Micro Rode NT-USB"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Date d’achat</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Prix (€)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Lien</label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
              placeholder="https://..."
            />
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
