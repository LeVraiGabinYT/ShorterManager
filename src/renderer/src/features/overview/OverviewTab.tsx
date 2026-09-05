import { useMemo, useState, type ReactElement } from 'react'
import type { OwnedObject, Series, Tag, VideoIdea, VideoIdeaInput } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { IdeaFormModal } from '../ideas/IdeaFormModal'
import { IdeaListRow } from '../ideas/IdeaListRow'

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

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
  tagsById: Map<number, Tag>
  seriesById: Map<number, Series>
  onSelect: (idea: VideoIdea) => void
}

function IdeaListSection({
  title,
  emptyLabel,
  ideas,
  objectsById,
  tagsById,
  seriesById,
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
              tagsById={tagsById}
              seriesById={seriesById}
              onClick={() => onSelect(idea)}
            />
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
    tagsById,
    series,
    seriesById,
    publishedVideos,
    publishedVideosByIdeaId,
    loading,
    refresh
  } = useIdeasData()
  const [selectedIdea, setSelectedIdea] = useState<VideoIdea | null>(null)
  const unlinkedVideos = useMemo(
    () => publishedVideos.filter((v) => v.ideaId === null),
    [publishedVideos]
  )

  const effective = useMemo(
    () => ideas.map((idea) => ({ idea, ...getEffectiveStatus(idea, objectsById) })),
    [ideas, objectsById]
  )

  const readyOrScheduledCount = effective.filter(
    (e) => e.status === 'ready' || e.status === 'scheduled'
  ).length
  const editingCount = effective.filter((e) => e.status === 'editing').length
  const shootingCount = effective.filter((e) => e.status === 'shooting').length

  const editingIdeas = effective.filter((e) => e.status === 'editing').map((e) => e.idea)
  const shootingToday = ideas.filter((idea) => isToday(idea.shootDate))
  const scheduledIdeas = effective.filter((e) => e.status === 'scheduled').map((e) => e.idea)
  const readyIdeas = effective.filter((e) => e.status === 'ready').map((e) => e.idea)

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
                title="Montage à faire"
                emptyLabel="Aucune vidéo à monter."
                ideas={editingIdeas}
                objectsById={objectsById}
                tagsById={tagsById}
                seriesById={seriesById}
                onSelect={setSelectedIdea}
              />
              <IdeaListSection
                title="Tournage aujourd’hui"
                emptyLabel="Aucun tournage prévu aujourd’hui."
                ideas={shootingToday}
                objectsById={objectsById}
                tagsById={tagsById}
                seriesById={seriesById}
                onSelect={setSelectedIdea}
              />
              <IdeaListSection
                title="Vidéos programmées"
                emptyLabel="Aucune vidéo programmée."
                ideas={scheduledIdeas}
                objectsById={objectsById}
                tagsById={tagsById}
                seriesById={seriesById}
                onSelect={setSelectedIdea}
              />
              <IdeaListSection
                title="Vidéos terminées"
                emptyLabel="Aucune vidéo prête."
                ideas={readyIdeas}
                objectsById={objectsById}
                tagsById={tagsById}
                seriesById={seriesById}
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
          onTagsChanged={refresh}
          onSeriesChanged={refresh}
          onLinkVideo={handleLinkVideo}
          onUnlinkVideo={handleUnlinkVideo}
        />
      )}
    </div>
  )
}
