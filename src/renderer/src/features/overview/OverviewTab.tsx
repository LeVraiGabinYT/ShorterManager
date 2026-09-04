import { useMemo, useState, type ReactElement } from 'react'
import type { VideoIdea, VideoIdeaInput } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { IdeaFormModal } from '../ideas/IdeaFormModal'

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
  onSelect: (idea: VideoIdea) => void
}

function IdeaListSection({
  title,
  emptyLabel,
  ideas,
  onSelect
}: IdeaListSectionProps): ReactElement {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-sm font-medium text-gray-200">{title}</h2>
      {ideas.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <button
                onClick={() => onSelect(idea)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-200 hover:bg-white/5"
              >
                {idea.emoji && <span className="mr-1.5">{idea.emoji}</span>}
                {idea.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function OverviewTab(): ReactElement {
  const { ideas, objects, objectsById, tags, loading, refresh } = useIdeasData()
  const [selectedIdea, setSelectedIdea] = useState<VideoIdea | null>(null)

  const effective = useMemo(
    () => ideas.map((idea) => ({ idea, ...getEffectiveStatus(idea, objectsById) })),
    [ideas, objectsById]
  )

  const readyOrScheduledCount = effective.filter(
    (e) => e.status === 'ready' || e.status === 'scheduled'
  ).length
  const editingCount = effective.filter((e) => e.status === 'editing').length
  const shootingCount = effective.filter((e) => e.status === 'shooting').length

  const shootingToday = ideas.filter((idea) => isToday(idea.shootDate))
  const publishingToday = ideas.filter((idea) => isToday(idea.publishDate))

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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <IdeaListSection
                title="Tournages aujourd’hui"
                emptyLabel="Aucun tournage prévu aujourd’hui."
                ideas={shootingToday}
                onSelect={setSelectedIdea}
              />
              <IdeaListSection
                title="Publication aujourd’hui"
                emptyLabel="Aucune publication prévue aujourd’hui."
                ideas={publishingToday}
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
          onClose={() => setSelectedIdea(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
          onTagsChanged={refresh}
        />
      )}
    </div>
  )
}
