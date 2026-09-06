import { useMemo, useState, type ReactElement } from 'react'
import type {
  IdeaStatus,
  OwnedObject,
  PublishedVideo,
  Series,
  Tag,
  VideoIdea,
  VideoIdeaInput
} from '@shared/types'
import { SearchablePicker } from '../../components/SearchablePicker'
import { formatDate } from '../../lib/format'
import { toIdeaInput } from '../../lib/ideaInput'
import { IdeaFormModal } from '../ideas/IdeaFormModal'
import { IdeaListRow } from '../ideas/IdeaListRow'

function sortByRecency(ideas: VideoIdea[]): VideoIdea[] {
  return [...ideas].sort((a, b) => {
    const da = a.publishDate ?? a.shootDate
    const db = b.publishDate ?? b.shootDate
    if (da === null && db === null) return 0
    if (da === null) return 1
    if (db === null) return -1
    return new Date(db).getTime() - new Date(da).getTime()
  })
}

function RemoveEpisodeAction({ onRemove }: { onRemove: () => void }): ReactElement {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="flex items-center gap-1 text-xs">
        <button
          type="button"
          onClick={onRemove}
          className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500"
        >
          Confirmer
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-gray-400 hover:text-gray-200"
        >
          Annuler
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-red-500/10 hover:text-red-300"
    >
      Retirer
    </button>
  )
}

const EMPTY_SERIES_MAP = new Map<number, Series>()

interface SeriesDetailModalProps {
  series: Series
  allIdeas: VideoIdea[]
  objects: OwnedObject[]
  objectsById: Map<number, OwnedObject>
  tags: Tag[]
  tagsById: Map<number, Tag>
  allSeries: Series[]
  publishedVideos: PublishedVideo[]
  publishedVideosByIdeaId: Map<number, PublishedVideo>
  statusColors: Record<IdeaStatus, string>
  showTags: boolean
  ruleMissingObjectsPreparation: boolean
  onClose: () => void
  onRename: (name: string) => Promise<void>
  onEmojiChange: (emoji: string) => Promise<void>
  onDeleteSeries: () => Promise<void>
  onSeriesChanged: () => Promise<void>
  refresh: () => Promise<void>
}

export function SeriesDetailModal({
  series,
  allIdeas,
  objects,
  objectsById,
  tags,
  tagsById,
  allSeries,
  publishedVideos,
  publishedVideosByIdeaId,
  statusColors,
  showTags,
  ruleMissingObjectsPreparation,
  onClose,
  onRename,
  onEmojiChange,
  onDeleteSeries,
  onSeriesChanged,
  refresh
}: SeriesDetailModalProps): ReactElement {
  const [editingIdea, setEditingIdea] = useState<VideoIdea | null>(null)
  const [creatingIdea, setCreatingIdea] = useState(false)
  const [addingExisting, setAddingExisting] = useState(false)
  const [confirmingDeleteSeries, setConfirmingDeleteSeries] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(series.name)

  const seriesIdeas = useMemo(
    () => sortByRecency(allIdeas.filter((idea) => idea.seriesId === series.id)),
    [allIdeas, series.id]
  )
  const otherIdeas = useMemo(
    () => allIdeas.filter((idea) => idea.seriesId !== series.id),
    [allIdeas, series.id]
  )
  const unlinkedVideos = useMemo(
    () => publishedVideos.filter((v) => v.ideaId === null),
    [publishedVideos]
  )

  function handleSaveName(): void {
    const trimmed = nameDraft.trim()
    if (trimmed && trimmed !== series.name) onRename(trimmed)
    else setNameDraft(series.name)
    setEditingName(false)
  }

  async function handleAddExisting(idea: VideoIdea): Promise<void> {
    await window.api.ideas.update(idea.id, { ...toIdeaInput(idea), seriesId: series.id })
    setAddingExisting(false)
    await refresh()
  }

  async function handleRemoveFromSeries(idea: VideoIdea): Promise<void> {
    await window.api.ideas.update(idea.id, { ...toIdeaInput(idea), seriesId: null })
    await refresh()
  }

  async function handleCreateIdea(input: VideoIdeaInput): Promise<void> {
    await window.api.ideas.create(input)
    setCreatingIdea(false)
    await refresh()
  }

  async function handleUpdateIdea(input: VideoIdeaInput): Promise<void> {
    if (!editingIdea) return
    await window.api.ideas.update(editingIdea.id, input)
    setEditingIdea(null)
    await refresh()
  }

  async function handleDeleteIdea(): Promise<void> {
    if (!editingIdea) return
    await window.api.ideas.remove(editingIdea.id)
    setEditingIdea(null)
    await refresh()
  }

  async function handleLinkVideo(youtubeVideoId: string): Promise<void> {
    if (!editingIdea) return
    await window.api.channel.linkVideoToIdea(youtubeVideoId, editingIdea.id)
    await refresh()
  }

  async function handleUnlinkVideo(): Promise<void> {
    const linkedVideo = editingIdea ? publishedVideosByIdeaId.get(editingIdea.id) : null
    if (!linkedVideo) return
    await window.api.channel.unlinkVideo(linkedVideo.youtubeVideoId)
    await refresh()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
        <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-white/10 bg-[#15161a] shadow-2xl">
          <div className="flex shrink-0 items-start gap-3 border-b border-white/10 p-5">
            <div className="w-14 shrink-0">
              <input
                value={series.emoji}
                onChange={(e) => onEmojiChange(e.target.value || '🎬')}
                className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-2 text-center text-lg outline-none focus:border-blue-500/60"
              />
            </div>

            <div className="min-w-0 flex-1">
              {editingName ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') {
                      setNameDraft(series.name)
                      setEditingName(false)
                    }
                  }}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-base font-semibold text-gray-100 outline-none focus:border-blue-500/60"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="text-left text-base font-semibold text-gray-100 hover:underline"
                >
                  {series.name}
                </button>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {seriesIdeas.length} vidéo{seriesIdeas.length > 1 ? 's' : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCreatingIdea(true)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                + Nouvelle vidéo
              </button>
              <button
                type="button"
                onClick={() => setAddingExisting((v) => !v)}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
              >
                + Vidéo existante
              </button>
            </div>

            {addingExisting && (
              <div className="mb-4">
                <SearchablePicker
                  items={otherIdeas}
                  getKey={(idea) => idea.id}
                  getLabel={(idea) => `${idea.title} · ${formatDate(idea.publishDate)}`}
                  onSelect={handleAddExisting}
                  placeholder="Rechercher une idée à ajouter à la série..."
                  emptyLabel="Aucune autre idée disponible."
                />
              </div>
            )}

            {seriesIdeas.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune vidéo dans cette série pour l’instant.</p>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.03]">
                {seriesIdeas.map((idea) => (
                  <IdeaListRow
                    key={idea.id}
                    idea={idea}
                    objectsById={objectsById}
                    seriesById={EMPTY_SERIES_MAP}
                    tagsById={tagsById}
                    statusColors={statusColors}
                    showTags={showTags}
                    ruleMissingObjectsPreparation={ruleMissingObjectsPreparation}
                    onClick={() => setEditingIdea(idea)}
                    trailingAction={
                      <RemoveEpisodeAction onRemove={() => handleRemoveFromSeries(idea)} />
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 justify-end border-t border-white/10 p-4">
            {confirmingDeleteSeries ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-red-300">Supprimer définitivement cette série ?</span>
                <button
                  type="button"
                  onClick={onDeleteSeries}
                  className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500"
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteSeries(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  Annuler
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDeleteSeries(true)}
                className="rounded-md px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
              >
                Supprimer la série
              </button>
            )}
          </div>
        </div>
      </div>

      {creatingIdea && (
        <IdeaFormModal
          idea={null}
          objects={objects}
          tags={tags}
          series={allSeries}
          existingIdeas={allIdeas}
          linkedVideo={null}
          unlinkedVideos={unlinkedVideos}
          ruleMissingObjectsPreparation={ruleMissingObjectsPreparation}
          defaultSeriesId={series.id}
          onClose={() => setCreatingIdea(false)}
          onSave={handleCreateIdea}
          onTagsChanged={refresh}
          onSeriesChanged={onSeriesChanged}
          onLinkVideo={() => {}}
          onUnlinkVideo={() => {}}
        />
      )}

      {editingIdea && (
        <IdeaFormModal
          idea={editingIdea}
          objects={objects}
          tags={tags}
          series={allSeries}
          existingIdeas={allIdeas}
          linkedVideo={publishedVideosByIdeaId.get(editingIdea.id) ?? null}
          unlinkedVideos={unlinkedVideos}
          ruleMissingObjectsPreparation={ruleMissingObjectsPreparation}
          onClose={() => setEditingIdea(null)}
          onSave={handleUpdateIdea}
          onDelete={handleDeleteIdea}
          onTagsChanged={refresh}
          onSeriesChanged={onSeriesChanged}
          onLinkVideo={handleLinkVideo}
          onUnlinkVideo={handleUnlinkVideo}
        />
      )}
    </>
  )
}
