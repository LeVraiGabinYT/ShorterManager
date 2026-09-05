import type { ReactElement } from 'react'
import type { PublishedVideo, VideoIdea } from '@shared/types'
import { formatDate } from '../../lib/format'

export interface BulkAddPlan {
  video: PublishedVideo
  existingIdea: VideoIdea | null
}

interface BulkDuplicateModalProps {
  plans: BulkAddPlan[]
  onCancel: () => void
  onAddNewOnly: () => void
  onMergeAndAddAll: () => void
}

export function BulkDuplicateModal({
  plans,
  onCancel,
  onAddNewOnly,
  onMergeAndAddAll
}: BulkDuplicateModalProps): ReactElement {
  const duplicates = plans.filter((p) => p.existingIdea !== null)
  const newOnes = plans.filter((p) => p.existingIdea === null)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-orange-500/30 bg-[#15161a] p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-100">
          {duplicates.length} vidéo{duplicates.length > 1 ? 's ont' : ' a'} déjà une idée avec le
          même titre
        </h2>

        <ul className="mt-3 space-y-1.5">
          {duplicates.map((plan) => (
            <li
              key={plan.video.youtubeVideoId}
              className="rounded-md border border-orange-500/20 bg-orange-500/5 px-2.5 py-1.5 text-xs text-gray-300"
            >
              {plan.video.title} · idée existante du{' '}
              {formatDate(plan.existingIdea?.publishDate ?? null)}
            </li>
          ))}
        </ul>

        {newOnes.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">
            Les {newOnes.length} autre{newOnes.length > 1 ? 's' : ''} vidéo
            {newOnes.length > 1 ? 's' : ''} sélectionnée{newOnes.length > 1 ? 's' : ''} n’a
            {newOnes.length > 1 ? 'ont' : ''} pas d’homonyme et seront ajoutées normalement.
          </p>
        )}

        <p className="mt-3 text-xs text-gray-500">
          « Tout copier et fusionner » lie chaque vidéo en double à son idée existante (tags
          combinés, statut et date synchronisés sur la vraie vidéo) au lieu de créer un doublon.
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onAddNewOnly}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Copier seulement les nouvelles
          </button>
          <button
            type="button"
            onClick={onMergeAndAddAll}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Tout copier et fusionner
          </button>
        </div>
      </div>
    </div>
  )
}
