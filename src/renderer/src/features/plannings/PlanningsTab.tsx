import { useMemo, useState, type ReactElement } from 'react'
import type { OwnedObject, Series, Tag, VideoIdea, VideoIdeaInput } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { sortIdeas } from '../../lib/ideaFilters'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { IdeaFormModal } from '../ideas/IdeaFormModal'
import { IdeaListRow } from '../ideas/IdeaListRow'

function isPastDate(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().slice(0, 10)
  return dateStr.slice(0, 10) < today
}

interface PlanningColumnProps {
  title: string
  emptyLabel: string
  ideas: VideoIdea[]
  objectsById: Map<number, OwnedObject>
  tagsById: Map<number, Tag>
  seriesById: Map<number, Series>
  onSelect: (idea: VideoIdea) => void
}

function PlanningColumn({
  title,
  emptyLabel,
  ideas,
  objectsById,
  tagsById,
  seriesById,
  onSelect
}: PlanningColumnProps): ReactElement {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <h2 className="shrink-0 px-4 pb-2 pt-4 text-sm font-medium text-gray-200">
        {title} ({ideas.length})
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {ideas.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-gray-500">{emptyLabel}</p>
        ) : (
          ideas.map((idea) => (
            <IdeaListRow
              key={idea.id}
              idea={idea}
              objectsById={objectsById}
              tagsById={tagsById}
              seriesById={seriesById}
              onClick={() => onSelect(idea)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function PlanningsTab(): ReactElement {
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

  // Neither planning cares about videos already scheduled or published — they're done, no
  // longer something to plan around.
  const eligibleIdeas = useMemo(
    () =>
      ideas.filter((idea) => {
        const { status } = getEffectiveStatus(idea, objectsById)
        return status !== 'scheduled' && status !== 'published'
      }),
    [ideas, objectsById]
  )

  const publicationPlanning = useMemo(
    () =>
      sortIdeas(
        eligibleIdeas.filter((idea) => !isPastDate(idea.publishDate)),
        { field: 'publishDate', direction: 'asc' }
      ),
    [eligibleIdeas]
  )

  const shootingPlanning = useMemo(
    () =>
      sortIdeas(
        eligibleIdeas.filter((idea) => !isPastDate(idea.shootDate)),
        { field: 'shootDate', direction: 'asc' }
      ),
    [eligibleIdeas]
  )

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
        <h1 className="text-lg font-semibold text-gray-100">Plannings</h1>
      </div>

      <div className="min-h-0 flex-1 px-6 pb-6">
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : (
          <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2">
            <PlanningColumn
              title="Planning des tournages"
              emptyLabel="Aucun tournage à planifier."
              ideas={shootingPlanning}
              objectsById={objectsById}
              tagsById={tagsById}
              seriesById={seriesById}
              onSelect={setSelectedIdea}
            />
            <PlanningColumn
              title="Planning de publication"
              emptyLabel="Aucune vidéo à planifier."
              ideas={publicationPlanning}
              objectsById={objectsById}
              tagsById={tagsById}
              seriesById={seriesById}
              onSelect={setSelectedIdea}
            />
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
