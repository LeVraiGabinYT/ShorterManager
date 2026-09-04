import { useState, type ReactElement } from 'react'
import type { PublishedVideo, Tag, VideoIdea } from '@shared/types'
import { SearchablePicker } from '../../components/SearchablePicker'
import { formatDate } from '../../lib/format'
import { TagPicker } from '../tags/TagPicker'

interface ChannelVideoDetailModalProps {
  video: PublishedVideo
  linkedIdea: VideoIdea | null
  unlinkedIdeas: VideoIdea[]
  tags: Tag[]
  onClose: () => void
  onAddToList: () => void
  onLinkToIdea: (ideaId: number) => void
  onUnlink: () => void
  onSetTags: (tagIds: number[]) => void
  onTagsChanged: () => void
}

export function ChannelVideoDetailModal({
  video,
  linkedIdea,
  unlinkedIdeas,
  tags,
  onClose,
  onAddToList,
  onLinkToIdea,
  onUnlink,
  onSetTags,
  onTagsChanged
}: ChannelVideoDetailModalProps): ReactElement {
  const [directTagIds, setDirectTagIds] = useState<number[]>(video.tagIds)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#15161a] p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        {video.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" className="mb-4 w-full rounded-lg object-cover" />
        )}

        <a
          href={video.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-lg font-semibold text-gray-100 underline hover:text-blue-300"
        >
          {video.title ?? video.videoUrl}
        </a>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
          <span>📅 {formatDate(video.publishedAt)}</span>
          <span>👁️ {video.viewCount ?? '—'} vues</span>
          <span>👍 {video.likeCount ?? '—'} likes</span>
          <span>💬 {video.commentCount ?? '—'} commentaires</span>
          {video.averageViewPercentage !== null && (
            <span>▶️ {video.averageViewPercentage.toFixed(0)}% de la vidéo regardée</span>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            {linkedIdea ? 'Tags (hérités de l’idée liée)' : 'Tags'}
          </label>
          {linkedIdea ? (
            <p className="text-xs text-gray-500">
              Modifie les tags depuis l’idée « {linkedIdea.title} » dans l’onglet Idées.
            </p>
          ) : (
            <TagPicker
              tags={tags}
              selectedIds={directTagIds}
              onChange={(ids) => {
                setDirectTagIds(ids)
                onSetTags(ids)
              }}
              onTagsChanged={onTagsChanged}
            />
          )}
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          {linkedIdea ? (
            <div>
              <p className="text-sm text-gray-300">
                Liée à l’idée <span className="font-medium text-gray-100">{linkedIdea.title}</span>
              </p>
              <button onClick={onUnlink} className="mt-2 text-xs text-gray-400 hover:text-red-300">
                Délier cette vidéo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={onAddToList}
                className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                Ajouter à la liste d’idées (nouvelle idée « Publiée »)
              </button>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  ...ou lier à une idée existante
                </label>
                <SearchablePicker
                  items={unlinkedIdeas}
                  getKey={(idea) => idea.id}
                  getLabel={(idea) => (idea.emoji ? `${idea.emoji} ${idea.title}` : idea.title)}
                  onSelect={(idea) => onLinkToIdea(idea.id)}
                  placeholder="Rechercher une idée par titre..."
                  emptyLabel="Aucune idée disponible à lier."
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
