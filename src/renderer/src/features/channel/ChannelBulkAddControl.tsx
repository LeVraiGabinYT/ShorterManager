import { useState, type ReactElement } from 'react'
import type { OwnedObject, Series, Tag } from '@shared/types'
import { SeriesPicker } from '../series/SeriesPicker'
import { TagPicker } from '../tags/TagPicker'

interface ChannelBulkAddControlProps {
  selectedCount: number
  tags: Tag[]
  objects: OwnedObject[]
  series: Series[]
  onAdd: (tagIds: number[], objectIds: number[], seriesId: number | null, emoji: string) => void
  onTagsChanged: () => Promise<void>
  onSeriesChanged: () => Promise<void>
}

export function ChannelBulkAddControl({
  selectedCount,
  tags,
  objects,
  series,
  onAdd,
  onTagsChanged,
  onSeriesChanged
}: ChannelBulkAddControlProps): ReactElement {
  const [tagIds, setTagIds] = useState<number[]>([])
  const [objectIds, setObjectIds] = useState<number[]>([])
  const [seriesId, setSeriesId] = useState<number | null>(null)
  const [emoji, setEmoji] = useState('')

  function toggleObject(id: number): void {
    setObjectIds((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]))
  }

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-3">
      <p className="text-xs text-gray-400">
        {selectedCount} vidéo{selectedCount > 1 ? 's' : ''} sélectionnée
        {selectedCount > 1 ? 's' : ''}
      </p>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">
          Tags à ajouter aux idées créées/fusionnées
        </label>
        <TagPicker
          tags={tags}
          selectedIds={tagIds}
          onChange={setTagIds}
          onTagsChanged={onTagsChanged}
        />
      </div>

      {objects.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400">Objets à ajouter</label>
          <div className="flex flex-wrap gap-1.5">
            {objects.map((obj) => (
              <button
                type="button"
                key={obj.id}
                onClick={() => toggleObject(obj.id)}
                className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                  objectIds.includes(obj.id)
                    ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {obj.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-400">Série</label>
          <SeriesPicker
            series={series}
            value={seriesId}
            onChange={setSeriesId}
            onSeriesChanged={onSeriesChanged}
          />
        </div>
        <div className="w-20 shrink-0">
          <label className="mb-1 block text-xs font-medium text-gray-400">Émoji</label>
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="🎬"
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-2 text-center text-sm text-gray-100 outline-none focus:border-blue-500/60"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAdd(tagIds, objectIds, seriesId, emoji.trim())}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
      >
        Ajouter à la liste d’idées
      </button>
    </div>
  )
}
