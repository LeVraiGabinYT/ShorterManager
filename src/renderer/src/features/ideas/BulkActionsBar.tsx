import type { ReactElement } from 'react'
import { IDEA_STATUSES } from '@shared/types'
import type { IdeaStatus, OwnedObject, Tag } from '@shared/types'

interface BulkActionsBarProps {
  selectedCount: number
  tags: Tag[]
  objects: OwnedObject[]
  onAddTag: (tagId: number) => void
  onAddObject: (objectId: number) => void
  onSetStatus: (status: IdeaStatus) => void
  onClear: () => void
}

export function BulkActionsBar({
  selectedCount,
  tags,
  objects,
  onAddTag,
  onAddObject,
  onSetStatus,
  onClear
}: BulkActionsBarProps): ReactElement {
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
        {tags.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            Ajouter le tag
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onAddTag(Number(e.target.value))
                  e.target.value = ''
                }
              }}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
            >
              <option value="" className="bg-[#15161a]">
                Choisir...
              </option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id} className="bg-[#15161a]">
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
        )}

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
      </div>
    </div>
  )
}
