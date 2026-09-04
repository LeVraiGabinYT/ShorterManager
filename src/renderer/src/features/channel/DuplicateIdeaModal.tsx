import type { ReactElement } from 'react'
import type { PublishedVideo, Tag, VideoIdea } from '@shared/types'
import { formatDate } from '../../lib/format'
import { getTagChipStyle } from '../../lib/tagColors'

interface DuplicateIdeaModalProps {
  video: PublishedVideo
  existingIdea: VideoIdea
  tagsById: Map<number, Tag>
  onMerge: () => void
  onCreateNew: () => void
  onCancel: () => void
}

function TagList({
  tagIds,
  tagsById
}: {
  tagIds: number[]
  tagsById: Map<number, Tag>
}): ReactElement {
  const tags = tagIds.map((id) => tagsById.get(id)).filter(Boolean) as Tag[]
  if (tags.length === 0) return <span className="text-xs text-gray-600">Aucun tag</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id}
          style={getTagChipStyle(tag.color)}
          className="rounded border px-1.5 py-0.5 text-[10px] font-medium"
        >
          {tag.name}
        </span>
      ))}
    </div>
  )
}

export function DuplicateIdeaModal({
  video,
  existingIdea,
  tagsById,
  onMerge,
  onCreateNew,
  onCancel
}: DuplicateIdeaModalProps): ReactElement {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-orange-500/30 bg-[#15161a] p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-gray-100">Une idée avec ce titre existe déjà</h2>
        <p className="mt-1 text-sm text-gray-400">« {existingIdea.title} »</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <h3 className="mb-1.5 text-xs font-medium text-gray-500">Idée existante</h3>
            <p className="text-sm text-gray-300">📅 {formatDate(existingIdea.publishDate)}</p>
            <div className="mt-1.5">
              <TagList tagIds={existingIdea.tagIds} tagsById={tagsById} />
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <h3 className="mb-1.5 text-xs font-medium text-gray-500">Vraie vidéo</h3>
            <p className="text-sm text-gray-300">📅 {formatDate(video.publishedAt)}</p>
            <div className="mt-1.5">
              <TagList tagIds={video.tagIds} tagsById={tagsById} />
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Fusionner liera la vidéo à l’idée existante (tags combinés, statut et date synchronisés
          sur la vraie vidéo) plutôt que de créer un doublon.
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
            onClick={onCreateNew}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Créer quand même une nouvelle idée
          </button>
          <button
            type="button"
            onClick={onMerge}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Fusionner et lier
          </button>
        </div>
      </div>
    </div>
  )
}
