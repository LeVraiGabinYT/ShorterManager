import { useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { IDEA_STATUSES } from '@shared/types'
import type {
  OwnedObject,
  PublishedVideo,
  Series,
  Tag,
  VideoIdea,
  VideoIdeaInput
} from '@shared/types'
import { SearchablePicker } from '../../components/SearchablePicker'
import { formatDate, toDateInputValue } from '../../lib/format'
import { SeriesPicker } from '../series/SeriesPicker'
import { TagPicker } from '../tags/TagPicker'

interface IdeaFormModalProps {
  idea: VideoIdea | null
  objects: OwnedObject[]
  tags: Tag[]
  series: Series[]
  existingIdeas: VideoIdea[]
  linkedVideo: PublishedVideo | null
  unlinkedVideos: PublishedVideo[]
  onClose: () => void
  onSave: (input: VideoIdeaInput) => void
  onDelete?: () => void
  onTagsChanged: () => void
  onSeriesChanged: () => Promise<void>
  onLinkVideo: (youtubeVideoId: string) => void
  onUnlinkVideo: () => void
}

export function IdeaFormModal({
  idea,
  objects,
  tags,
  series,
  existingIdeas,
  linkedVideo,
  unlinkedVideos,
  onClose,
  onSave,
  onDelete,
  onTagsChanged,
  onSeriesChanged,
  onLinkVideo,
  onUnlinkVideo
}: IdeaFormModalProps): ReactElement {
  const [title, setTitle] = useState(idea?.title ?? '')
  const [emoji, setEmoji] = useState(idea?.emoji ?? '')
  const [description, setDescription] = useState(idea?.description ?? '')
  const [status, setStatus] = useState<VideoIdeaInput['status']>(idea?.status ?? 'idea')
  const [publishDate, setPublishDate] = useState(toDateInputValue(idea?.publishDate ?? null))
  const [shootDate, setShootDate] = useState(toDateInputValue(idea?.shootDate ?? null))
  const [objectIds, setObjectIds] = useState<number[]>(idea?.objectIds ?? [])
  const [tagIds, setTagIds] = useState<number[]>(idea?.tagIds ?? [])
  const [seriesId, setSeriesId] = useState<number | null>(idea?.seriesId ?? null)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function toggleObject(id: number): void {
    setObjectIds((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]))
  }

  const missingObjects = useMemo(() => {
    const objectsById = new Map(objects.map((o) => [o.id, o]))
    return objectIds.some((id) => objectsById.get(id)?.purchased === false)
  }, [objects, objectIds])

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const duplicate = existingIdeas.some(
      (other) => other.id !== idea?.id && other.title.trim() === trimmedTitle
    )
    if (duplicate) {
      setTitleError('Une idée avec exactement ce titre existe déjà.')
      return
    }
    setTitleError(null)

    onSave({
      title: trimmedTitle,
      emoji: emoji.trim() || null,
      description: description.trim() || null,
      status,
      publishDate: publishDate || null,
      shootDate: shootDate || null,
      objectIds,
      tagIds,
      seriesId
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-white/10 bg-[#15161a] shadow-2xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 className="text-lg font-semibold text-gray-100">
            {idea ? "Modifier l'idée" : 'Nouvelle idée'}
          </h2>

          {missingObjects && status !== 'published' && (
            <p className="mt-3 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-300">
              Objets manquants : cette idée s’affiche comme « Préparation » tant que tous les objets
              nécessaires ne sont pas marqués comme achetés.
            </p>
          )}

          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <div className="w-16 shrink-0">
                <label className="block text-xs font-medium text-gray-400 mb-1">Émoji</label>
                <input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="🎬"
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-2 text-center text-lg outline-none focus:border-blue-500/60"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-400 mb-1">Titre</label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (titleError) setTitleError(null)
                  }}
                  required
                  className={`w-full rounded-md border bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 ${
                    titleError ? 'border-red-500/60' : 'border-white/10'
                  }`}
                  placeholder="Titre de la vidéo"
                />
                {titleError && <p className="mt-1 text-xs text-red-400">{titleError}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Description <span className="text-gray-600">(non visible dans la liste)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 resize-none"
                placeholder="Notes, script, angle de la vidéo..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as VideoIdeaInput['status'])}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
                >
                  {IDEA_STATUSES.map((s) => (
                    <option key={s.value} value={s.value} className="bg-[#15161a]">
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div />

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Date de tournage
                </label>
                <input
                  type="date"
                  value={shootDate}
                  onChange={(e) => setShootDate(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Date de publication
                </label>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Série</label>
              <SeriesPicker
                series={series}
                value={seriesId}
                onChange={setSeriesId}
                onSeriesChanged={onSeriesChanged}
              />
            </div>

            {idea && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Vidéo publiée liée
                </label>
                {linkedVideo ? (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <a
                      href={linkedVideo.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-emerald-300 underline hover:text-emerald-200"
                    >
                      {linkedVideo.title ?? linkedVideo.videoUrl}
                    </a>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                      <span>👁️ {linkedVideo.viewCount ?? '—'} vues</span>
                      <span>👍 {linkedVideo.likeCount ?? '—'} likes</span>
                      <span>💬 {linkedVideo.commentCount ?? '—'} commentaires</span>
                      <span>📅 {formatDate(linkedVideo.publishedAt)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={onUnlinkVideo}
                      className="mt-2 text-xs text-gray-400 hover:text-red-300"
                    >
                      Délier cette vidéo
                    </button>
                  </div>
                ) : (
                  <SearchablePicker
                    items={unlinkedVideos}
                    getKey={(video) => video.youtubeVideoId}
                    getLabel={(video) =>
                      `${video.title ?? video.youtubeVideoId} (${formatDate(video.publishedAt)})`
                    }
                    onSelect={(video) => onLinkVideo(video.youtubeVideoId)}
                    placeholder="Rechercher une vidéo déjà postée par titre..."
                    emptyLabel="Aucune vidéo postée disponible à lier (onglet « Chaîne YouTube »)."
                  />
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tags</label>
              <TagPicker
                tags={tags}
                selectedIds={tagIds}
                onChange={setTagIds}
                onTagsChanged={onTagsChanged}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Objets nécessaires
              </label>
              {objects.length === 0 ? (
                <p className="text-xs text-gray-600">
                  Aucun objet enregistré pour l’instant (onglet « Objets achetés »).
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {objects.map((obj) => {
                    const selected = objectIds.includes(obj.id)
                    return (
                      <button
                        type="button"
                        key={obj.id}
                        onClick={() => toggleObject(obj.id)}
                        className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                          selected
                            ? obj.purchased
                              ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                              : 'border-red-500/50 bg-red-500/20 text-red-300'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {obj.name}
                        {!obj.purchased && ' (non acheté)'}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {onDelete && (
              <div className="mt-6 border-t border-white/10 pt-4">
                {confirmingDelete ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-300">Supprimer définitivement cette idée ?</span>
                    <button
                      type="button"
                      onClick={onDelete}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500"
                    >
                      Confirmer
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
                    className="rounded-md px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 p-4">
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
      </form>
    </div>
  )
}
