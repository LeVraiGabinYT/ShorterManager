import { useMemo, useState, type ReactElement } from 'react'
import type {
  OwnedObject,
  OwnedObjectInput,
  Series,
  VideoIdea,
  VideoIdeaInput
} from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { formatDate, formatPrice } from '../../lib/format'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { ideaUrgencyDate, objectsToBuy, sortByUrgency, type ObjectToBuy } from '../../lib/priority'
import { IdeaFormModal } from '../ideas/IdeaFormModal'
import { IdeaListRow } from '../ideas/IdeaListRow'
import { ObjectFormModal } from '../objects/ObjectFormModal'

interface StatCardProps {
  label: string
  value: number
  accent: string
}

function StatCard({ label, value, accent }: StatCardProps): ReactElement {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <p className={`text-3xl font-semibold ${accent}`}>{value}</p>
      <p className="mt-1 text-sm text-gray-400">{label}</p>
    </div>
  )
}

interface IdeaListSectionProps {
  title: string
  emptyLabel: string
  ideas: VideoIdea[]
  objectsById: Map<number, OwnedObject>
  seriesById: Map<number, Series>
  ruleMissingObjectsPreparation: boolean
  onSelect: (idea: VideoIdea) => void
}

function IdeaListSection({
  title,
  emptyLabel,
  ideas,
  objectsById,
  seriesById,
  ruleMissingObjectsPreparation,
  onSelect
}: IdeaListSectionProps): ReactElement {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <h2 className="px-4 pt-3 pb-2 text-sm font-medium text-gray-200">
        {title} ({ideas.length})
      </h2>
      {ideas.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <div className="border-t border-white/10">
          {ideas.map((idea) => (
            <IdeaListRow
              key={idea.id}
              idea={idea}
              objectsById={objectsById}
              seriesById={seriesById}
              ruleMissingObjectsPreparation={ruleMissingObjectsPreparation}
              onClick={() => onSelect(idea)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ObjectsToBuySectionProps {
  entries: ObjectToBuy[]
  onTogglePurchased: (object: OwnedObject) => void
  onSelect: (object: OwnedObject) => void
}

function ObjectsToBuySection({
  entries,
  onTogglePurchased,
  onSelect
}: ObjectsToBuySectionProps): ReactElement {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <h2 className="px-4 pt-3 pb-2 text-sm font-medium text-gray-200">
        Objets à acheter ({entries.length})
      </h2>
      {entries.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-gray-500">Rien à acheter pour l’instant.</p>
      ) : (
        <div className="border-t border-white/10">
          {entries.map(({ object, nearestDate, neededByIdeas }) => (
            <div
              key={object.id}
              onClick={() => onSelect(object)}
              className="flex w-full cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors last:border-b-0 hover:bg-white/[0.04]"
            >
              <input
                type="checkbox"
                checked={false}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onTogglePurchased(object)}
                className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-blue-600"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-gray-100">{object.name}</span>
                  {object.price !== null && (
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatPrice(object.price)}
                    </span>
                  )}
                </div>
                {neededByIdeas.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    Pour : {neededByIdeas.map((idea) => idea.title).join(', ')}
                  </p>
                )}
              </div>

              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  nearestDate
                    ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                    : 'border-white/10 bg-white/5 text-gray-500'
                }`}
              >
                {nearestDate ? formatDate(nearestDate) : 'Pas de date'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function OverviewTab(): ReactElement {
  const {
    ideas,
    objects,
    objectsById,
    tags,
    series,
    seriesById,
    publishedVideos,
    publishedVideosByIdeaId,
    settings,
    loading,
    refresh
  } = useIdeasData()
  const [selectedIdea, setSelectedIdea] = useState<VideoIdea | null>(null)
  const [editingObject, setEditingObject] = useState<OwnedObject | null>(null)
  const unlinkedVideos = useMemo(
    () => publishedVideos.filter((v) => v.ideaId === null),
    [publishedVideos]
  )

  const effective = useMemo(
    () =>
      ideas.map((idea) => ({
        idea,
        ...getEffectiveStatus(idea, objectsById, settings.ruleMissingObjectsPreparation)
      })),
    [ideas, objectsById, settings.ruleMissingObjectsPreparation]
  )

  const readyOrScheduledCount = effective.filter(
    (e) => e.status === 'ready' || e.status === 'scheduled'
  ).length
  const editingCount = effective.filter((e) => e.status === 'editing').length
  const shootingCount = effective.filter((e) => e.status === 'shooting').length

  // Each list is sorted by whichever of an idea's shoot/publish date is soonest, so the most
  // urgent ideas — the ones with a deadline coming up — always surface at the top.
  const preparationIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'preparation').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )
  const shootingIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'shooting').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )
  const editingIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'editing').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )
  const toScheduleIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'ready').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )
  const scheduledIdeas = useMemo(
    () =>
      sortByUrgency(
        effective.filter((e) => e.status === 'scheduled').map((e) => e.idea),
        ideaUrgencyDate
      ),
    [effective]
  )

  const objectsNeeded = useMemo(() => objectsToBuy(objects, ideas), [objects, ideas])

  async function handleUpdate(input: VideoIdeaInput): Promise<void> {
    if (!selectedIdea) return
    await window.api.ideas.update(selectedIdea.id, input)
    setSelectedIdea(null)
    await refresh()
  }

  async function handleDelete(): Promise<void> {
    if (!selectedIdea) return
    await window.api.ideas.remove(selectedIdea.id)
    setSelectedIdea(null)
    await refresh()
  }

  async function handleLinkVideo(youtubeVideoId: string): Promise<void> {
    if (!selectedIdea) return
    await window.api.channel.linkVideoToIdea(youtubeVideoId, selectedIdea.id)
    await refresh()
  }

  async function handleUnlinkVideo(): Promise<void> {
    const linkedVideo = selectedIdea ? publishedVideosByIdeaId.get(selectedIdea.id) : null
    if (!linkedVideo) return
    await window.api.channel.unlinkVideo(linkedVideo.youtubeVideoId)
    await refresh()
  }

  async function handleToggleObjectPurchased(obj: OwnedObject): Promise<void> {
    await window.api.objects.update(obj.id, {
      name: obj.name,
      description: obj.description,
      purchaseDate: obj.purchaseDate,
      price: obj.price,
      link: obj.link,
      purchased: true
    })
    await refresh()
  }

  async function handleUpdateObject(input: OwnedObjectInput): Promise<void> {
    if (!editingObject) return
    await window.api.objects.update(editingObject.id, input)
    setEditingObject(null)
    await refresh()
  }

  async function handleDeleteObject(): Promise<void> {
    if (!editingObject) return
    await window.api.objects.remove(editingObject.id)
    setEditingObject(null)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Vue d’ensemble</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label="Prêtes + Programmées"
                value={readyOrScheduledCount}
                accent="text-emerald-400"
              />
              <StatCard label="À monter" value={editingCount} accent="text-violet-400" />
              <StatCard label="À filmer" value={shootingCount} accent="text-amber-400" />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <IdeaListSection
                title="À préparer"
                emptyLabel="Aucune idée à préparer."
                ideas={preparationIdeas}
                objectsById={objectsById}
                seriesById={seriesById}
                ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
                onSelect={setSelectedIdea}
              />
              <ObjectsToBuySection
                entries={objectsNeeded}
                onTogglePurchased={handleToggleObjectPurchased}
                onSelect={setEditingObject}
              />
              <IdeaListSection
                title="Tournages"
                emptyLabel="Aucun tournage à prévoir."
                ideas={shootingIdeas}
                objectsById={objectsById}
                seriesById={seriesById}
                ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
                onSelect={setSelectedIdea}
              />
              <IdeaListSection
                title="Montages"
                emptyLabel="Aucune vidéo à monter."
                ideas={editingIdeas}
                objectsById={objectsById}
                seriesById={seriesById}
                ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
                onSelect={setSelectedIdea}
              />
              <IdeaListSection
                title="À programmer"
                emptyLabel="Aucune vidéo prête à programmer."
                ideas={toScheduleIdeas}
                objectsById={objectsById}
                seriesById={seriesById}
                ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
                onSelect={setSelectedIdea}
              />
              <IdeaListSection
                title="Prochaines publications"
                emptyLabel="Aucune vidéo programmée."
                ideas={scheduledIdeas}
                objectsById={objectsById}
                seriesById={seriesById}
                ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
                onSelect={setSelectedIdea}
              />
            </div>
          </div>
        )}
      </div>

      {selectedIdea && (
        <IdeaFormModal
          idea={selectedIdea}
          objects={objects}
          tags={tags}
          series={series}
          existingIdeas={ideas}
          linkedVideo={publishedVideosByIdeaId.get(selectedIdea.id) ?? null}
          unlinkedVideos={unlinkedVideos}
          onClose={() => setSelectedIdea(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
          ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
          onTagsChanged={refresh}
          onSeriesChanged={refresh}
          onLinkVideo={handleLinkVideo}
          onUnlinkVideo={handleUnlinkVideo}
        />
      )}

      {editingObject && (
        <ObjectFormModal
          object={editingObject}
          onClose={() => setEditingObject(null)}
          onSave={handleUpdateObject}
          onDelete={handleDeleteObject}
        />
      )}
    </div>
  )
}
