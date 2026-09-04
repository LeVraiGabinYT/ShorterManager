import { useMemo, useState, type ReactElement } from 'react'
import type { AnalysisGroup, PublishedVideo } from '@shared/types'
import { formatDate } from '../../lib/format'
import { computeVideoStats } from '../../lib/videoStats'
import { StatsSummary } from './StatsSummary'

interface GroupsPanelProps {
  groups: AnalysisGroup[]
  publishedVideos: PublishedVideo[]
  onGroupsChanged: () => Promise<void>
}

const COMPARISON_ACCENTS = [
  'text-blue-300',
  'text-orange-300',
  'text-emerald-300',
  'text-violet-300',
  'text-pink-300'
]

function GroupCard({
  group,
  videos,
  compared,
  onToggleCompare,
  onRename,
  onDelete,
  onRemoveVideo
}: {
  group: AnalysisGroup
  videos: PublishedVideo[]
  compared: boolean
  onToggleCompare: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onRemoveVideo: (youtubeVideoId: string) => void
}): ReactElement {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [expanded, setExpanded] = useState(false)
  const stats = useMemo(() => computeVideoStats(videos), [videos])

  function handleSave(): void {
    const trimmed = name.trim()
    if (trimmed && trimmed !== group.name) onRename(trimmed)
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-w-0 items-center gap-2">
          <input
            type="checkbox"
            checked={compared}
            onChange={onToggleCompare}
            className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-blue-600"
          />
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') {
                  setName(group.name)
                  setEditing(false)
                }
              }}
              className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="truncate text-sm font-medium text-gray-100 hover:underline"
            >
              {group.name}
            </button>
          )}
        </label>
        <div className="flex shrink-0 items-center gap-3 text-xs text-gray-500">
          <span>
            {videos.length} vidéo{videos.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="hover:text-gray-300"
          >
            {expanded ? 'Réduire' : 'Détails'}
          </button>
          <button type="button" onClick={onDelete} className="hover:text-red-300">
            Supprimer
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <StatsSummary stats={stats} />
          {videos.length > 0 && (
            <ul className="space-y-1">
              {videos.map((video) => (
                <li
                  key={video.youtubeVideoId}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                >
                  <span className="truncate">
                    {video.title} · {formatDate(video.publishedAt)} ·{' '}
                    {video.viewCount?.toLocaleString('fr-FR') ?? '—'} vues
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveVideo(video.youtubeVideoId)}
                    className="shrink-0 text-gray-500 hover:text-red-300"
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function GroupsPanel({
  groups,
  publishedVideos,
  onGroupsChanged
}: GroupsPanelProps): ReactElement {
  const [comparedIds, setComparedIds] = useState<Set<number>>(new Set())

  const videosByYoutubeId = useMemo(
    () => new Map(publishedVideos.map((v) => [v.youtubeVideoId, v])),
    [publishedVideos]
  )

  function getGroupVideos(group: AnalysisGroup): PublishedVideo[] {
    return group.videoIds.map((id) => videosByYoutubeId.get(id)).filter(Boolean) as PublishedVideo[]
  }

  function toggleCompare(id: number): void {
    setComparedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleRename(id: number, name: string): Promise<void> {
    await window.api.analysisGroups.rename(id, name)
    await onGroupsChanged()
  }

  async function handleDelete(id: number): Promise<void> {
    await window.api.analysisGroups.remove(id)
    setComparedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    await onGroupsChanged()
  }

  async function handleRemoveVideo(groupId: number, youtubeVideoId: string): Promise<void> {
    await window.api.analysisGroups.removeVideo(groupId, youtubeVideoId)
    await onGroupsChanged()
  }

  const comparedGroups = groups.filter((g) => comparedIds.has(g.id))

  return (
    <div className="space-y-4">
      {groups.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aucun groupe pour l’instant. Crée-en un depuis l’onglet Explorer en sélectionnant des
          vidéos.
        </p>
      ) : (
        <>
          {comparedGroups.length >= 2 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {comparedGroups.map((group, i) => (
                <StatsSummary
                  key={group.id}
                  stats={computeVideoStats(getGroupVideos(group))}
                  title={group.name}
                  accent={COMPARISON_ACCENTS[i % COMPARISON_ACCENTS.length]}
                />
              ))}
            </div>
          )}

          <div className="space-y-2">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                videos={getGroupVideos(group)}
                compared={comparedIds.has(group.id)}
                onToggleCompare={() => toggleCompare(group.id)}
                onRename={(name) => handleRename(group.id, name)}
                onDelete={() => handleDelete(group.id)}
                onRemoveVideo={(videoId) => handleRemoveVideo(group.id, videoId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
