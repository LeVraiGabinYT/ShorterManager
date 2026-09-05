import { useState, type ReactElement } from 'react'
import { IDEA_STATUSES } from '@shared/types'
import type { IdeaStatus, OwnedObject, Series, Tag } from '@shared/types'
import { SearchablePicker } from '../../components/SearchablePicker'
import { randomTagColor } from '../../lib/tagColors'

interface BulkActionsBarProps {
  selectedCount: number
  tags: Tag[]
  objects: OwnedObject[]
  series: Series[]
  onAddTag: (tagId: number) => void
  onAddObject: (objectId: number) => void
  onSetStatus: (status: IdeaStatus) => void
  onSetSeries: (seriesId: number | null) => void
  onSetEmoji: (emoji: string) => void
  onDelete: () => void
  onClear: () => void
  onTagsChanged: () => Promise<void>
}

function NewTagControl({
  onAddTag,
  onTagsChanged
}: {
  onAddTag: (tagId: number) => void
  onTagsChanged: () => Promise<void>
}): ReactElement {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  async function handleCreate(): Promise<void> {
    const trimmed = name.trim()
    if (!trimmed) return
    const tag = await window.api.tags.create({ name: trimmed, color: randomTagColor() })
    await onTagsChanged()
    onAddTag(tag.id)
    setName('')
    setCreating(false)
  }

  if (!creating) {
    return (
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="text-xs text-gray-500 hover:text-gray-300"
      >
        + Nouveau tag
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleCreate()
          }
          if (e.key === 'Escape') setCreating(false)
        }}
        placeholder="Nom du tag"
        className="w-28 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
      />
      <button
        type="button"
        onClick={handleCreate}
        className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-500"
      >
        Ajouter
      </button>
    </div>
  )
}

export function BulkActionsBar({
  selectedCount,
  tags,
  objects,
  series,
  onAddTag,
  onAddObject,
  onSetStatus,
  onSetSeries,
  onSetEmoji,
  onDelete,
  onClear,
  onTagsChanged
}: BulkActionsBarProps): ReactElement {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [emojiInput, setEmojiInput] = useState('')

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {selectedCount} idée{selectedCount > 1 ? 's' : ''} sélectionnée
          {selectedCount > 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Tout désélectionner
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          Ajouter le tag
          <div className="w-40">
            <SearchablePicker
              items={tags}
              getKey={(tag) => tag.id}
              getLabel={(tag) => tag.name}
              onSelect={(tag) => onAddTag(tag.id)}
              placeholder="Rechercher un tag..."
              emptyLabel="Aucun tag créé."
            />
          </div>
        </div>

        <NewTagControl onAddTag={onAddTag} onTagsChanged={onTagsChanged} />

        {objects.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            Ajouter l’objet
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onAddObject(Number(e.target.value))
                  e.target.value = ''
                }
              }}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
            >
              <option value="" className="bg-[#15161a]">
                Choisir...
              </option>
              {objects.map((obj) => (
                <option key={obj.id} value={obj.id} className="bg-[#15161a]">
                  {obj.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          Changer le statut
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onSetStatus(e.target.value as IdeaStatus)
                e.target.value = ''
              }
            }}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
          >
            <option value="" className="bg-[#15161a]">
              Choisir...
            </option>
            {IDEA_STATUSES.map((s) => (
              <option key={s.value} value={s.value} className="bg-[#15161a]">
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          Émoji
          <input
            value={emojiInput}
            onChange={(e) => setEmojiInput(e.target.value)}
            placeholder="🎬"
            className="w-12 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-center text-xs text-gray-100 outline-none focus:border-blue-500/60"
          />
          <button
            type="button"
            onClick={() => {
              if (emojiInput.trim()) {
                onSetEmoji(emojiInput.trim())
                setEmojiInput('')
              }
            }}
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
          >
            Appliquer
          </button>
        </div>

        {series.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            Changer la série
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onSetSeries(e.target.value === 'none' ? null : Number(e.target.value))
                  e.target.value = ''
                }
              }}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
            >
              <option value="" className="bg-[#15161a]">
                Choisir...
              </option>
              <option value="none" className="bg-[#15161a]">
                Aucune
              </option>
              {series.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#15161a]">
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="ml-auto">
          {confirmingDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-300">Supprimer {selectedCount} idée(s) ?</span>
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
              className="text-xs text-red-400 hover:text-red-300"
            >
              Supprimer la sélection
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
