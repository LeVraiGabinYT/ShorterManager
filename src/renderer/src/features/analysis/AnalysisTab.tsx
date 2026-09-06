import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useIdeasData } from '../../hooks/useIdeasData'
import { computeVideoStats } from '../../lib/videoStats'
import { AddVideosModal } from './AddVideosModal'
import { ComparisonChart } from './ComparisonChart'
import { DatasetBarChart } from './DatasetBarChart'
import { GroupEvolutionChart } from './GroupEvolutionChart'
import { GroupVideosPanel } from './GroupVideosPanel'
import { StatsSummary } from './StatsSummary'
import { TagTrendsPanel } from './TagTrendsPanel'

const DISPLAY_MODES = [
  { id: 'dataset', label: 'Jeu de données' },
  { id: 'evolution', label: 'Évolution dans le temps' },
  { id: 'comparison', label: 'Comparaison' },
  { id: 'trends', label: 'Tendances de chaîne' }
] as const

type DisplayMode = (typeof DISPLAY_MODES)[number]['id']
type GroupId = 'blue' | 'orange'

const STORAGE_KEY = 'analysisTab.groups'

interface StoredGroups {
  blue: string[]
  orange: string[]
  displayMode: DisplayMode
}

// Remembers the two groups (and which view was active) across tab switches — a video id that
// later disappears (deleted, wiped, replaced from a backup) is just quietly dropped rather than
// ever crashing anything, since every consumer already filters ids against the live video list.
function loadStoredGroups(): StoredGroups {
  const fallback: StoredGroups = { blue: [], orange: [], displayMode: 'dataset' }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<StoredGroups> | null
    if (!parsed || typeof parsed !== 'object') return fallback

    const toStringArray = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []

    const displayMode = DISPLAY_MODES.some((m) => m.id === parsed.displayMode)
      ? (parsed.displayMode as DisplayMode)
      : fallback.displayMode

    return { blue: toStringArray(parsed.blue), orange: toStringArray(parsed.orange), displayMode }
  } catch {
    return fallback
  }
}

export function AnalysisTab(): ReactElement {
  const { ideasById, tags, objects, series, tagsById, publishedVideos, loading } = useIdeasData()
  // Analyse only ever reasons about videos linked to an idea in the workspace — a video the
  // channel fetched but nobody turned into an idea stays exclusive to the "Chaîne YouTube" tab,
  // never leaking into groups, the add-video picker, or Tendances de chaîne on its own.
  const linkedPublishedVideos = useMemo(
    () => publishedVideos.filter((v) => v.ideaId !== null),
    [publishedVideos]
  )
  const [stored] = useState(loadStoredGroups)
  const [displayMode, setDisplayMode] = useState<DisplayMode>(stored.displayMode)

  const [blueVideoIds, setBlueVideoIds] = useState<Set<string>>(() => new Set(stored.blue))
  const [orangeVideoIds, setOrangeVideoIds] = useState<Set<string>>(() => new Set(stored.orange))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [addModalTarget, setAddModalTarget] = useState<GroupId | null>(null)

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ blue: [...blueVideoIds], orange: [...orangeVideoIds], displayMode })
    )
  }, [blueVideoIds, orangeVideoIds, displayMode])

  // Prunes ids that no longer correspond to a real video — only once the channel cache has
  // actually finished loading, so we never wipe a restored group just because the initial fetch
  // hasn't resolved yet.
  useEffect(() => {
    if (loading) return
    const validIds = new Set(linkedPublishedVideos.map((v) => v.youtubeVideoId))
    setBlueVideoIds((prev) => {
      const filtered = [...prev].filter((id) => validIds.has(id))
      return filtered.length === prev.size ? prev : new Set(filtered)
    })
    setOrangeVideoIds((prev) => {
      const filtered = [...prev].filter((id) => validIds.has(id))
      return filtered.length === prev.size ? prev : new Set(filtered)
    })
  }, [loading, linkedPublishedVideos])

  const blueVideos = useMemo(
    () => linkedPublishedVideos.filter((v) => blueVideoIds.has(v.youtubeVideoId)),
    [linkedPublishedVideos, blueVideoIds]
  )
  const orangeVideos = useMemo(
    () => linkedPublishedVideos.filter((v) => orangeVideoIds.has(v.youtubeVideoId)),
    [linkedPublishedVideos, orangeVideoIds]
  )
  const blueStats = useMemo(() => computeVideoStats(blueVideos), [blueVideos])
  const orangeStats = useMemo(() => computeVideoStats(orangeVideos), [orangeVideos])

  // A video only ever belongs to one group at a time — adding it to one side always pulls it out
  // of the other, so "moving" and "adding" are the same operation under the hood.
  function addToGroup(group: GroupId, videoIds: string[]): void {
    const setter = group === 'blue' ? setBlueVideoIds : setOrangeVideoIds
    const otherSetter = group === 'blue' ? setOrangeVideoIds : setBlueVideoIds
    setter((prev) => new Set([...prev, ...videoIds]))
    otherSetter((prev) => {
      const next = new Set(prev)
      for (const id of videoIds) next.delete(id)
      return next
    })
  }

  function clearFromSelection(videoIds: string[]): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of videoIds) next.delete(id)
      return next
    })
  }

  function handleMoveOne(id: string, from: GroupId): void {
    addToGroup(from === 'blue' ? 'orange' : 'blue', [id])
    clearFromSelection([id])
  }

  function handleMoveSelected(from: GroupId): void {
    const sourceIds = from === 'blue' ? blueVideoIds : orangeVideoIds
    const idsToMove = [...selectedIds].filter((id) => sourceIds.has(id))
    if (idsToMove.length === 0) return
    addToGroup(from === 'blue' ? 'orange' : 'blue', idsToMove)
    clearFromSelection(idsToMove)
  }

  function removeFromGroup(group: GroupId, videoIds: string[]): void {
    const setter = group === 'blue' ? setBlueVideoIds : setOrangeVideoIds
    setter((prev) => {
      const next = new Set(prev)
      for (const id of videoIds) next.delete(id)
      return next
    })
    clearFromSelection(videoIds)
  }

  function handleRemoveOne(id: string, from: GroupId): void {
    removeFromGroup(from, [id])
  }

  function handleRemoveSelected(from: GroupId): void {
    const sourceIds = from === 'blue' ? blueVideoIds : orangeVideoIds
    const idsToRemove = [...selectedIds].filter((id) => sourceIds.has(id))
    if (idsToRemove.length === 0) return
    removeFromGroup(from, idsToRemove)
  }

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const availableForAdd = useMemo(() => {
    if (addModalTarget === null) return []
    const excludeIds = addModalTarget === 'blue' ? blueVideoIds : orangeVideoIds
    return linkedPublishedVideos.filter((v) => !excludeIds.has(v.youtubeVideoId))
  }, [addModalTarget, linkedPublishedVideos, blueVideoIds, orangeVideoIds])

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Analyse</h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6">
        {linkedPublishedVideos.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune vidéo publiée liée à une idée pour l’instant. Lie une vidéo publiée à une idée
            (onglet « Idées » ou « Chaîne YouTube ») avant de pouvoir l’analyser ici.
          </p>
        ) : (
          <div
            className={`flex flex-col gap-4 ${displayMode === 'trends' ? 'min-h-0 flex-1' : ''}`}
          >
            <div className="flex shrink-0 gap-1 rounded-md border border-white/10 bg-white/5 p-1">
              {DISPLAY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setDisplayMode(mode.id)}
                  className={`flex-1 rounded px-3 py-1.5 text-sm transition-colors ${
                    displayMode === mode.id
                      ? 'bg-white/10 text-gray-100'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {displayMode === 'trends' ? (
              <div className="min-h-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <TagTrendsPanel
                  tags={tags}
                  tagsById={tagsById}
                  publishedVideos={linkedPublishedVideos}
                />
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  {displayMode === 'dataset' && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-200">
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#3987e5]" />
                          Groupe Bleu
                        </h3>
                        <DatasetBarChart videos={blueVideos} />
                        <StatsSummary stats={blueStats} />
                      </div>
                      <div className="space-y-3">
                        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-200">
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#d95926]" />
                          Groupe Orange
                        </h3>
                        <DatasetBarChart videos={orangeVideos} />
                        <StatsSummary stats={orangeStats} />
                      </div>
                    </div>
                  )}

                  {displayMode === 'evolution' && (
                    <GroupEvolutionChart blueVideos={blueVideos} orangeVideos={orangeVideos} />
                  )}

                  {displayMode === 'comparison' && (
                    <ComparisonChart
                      labelA="Groupe Bleu"
                      labelB="Groupe Orange"
                      statsA={blueStats}
                      statsB={orangeStats}
                    />
                  )}
                </div>

                <GroupVideosPanel
                  blueVideos={blueVideos}
                  orangeVideos={orangeVideos}
                  tagsById={tagsById}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onAddClick={setAddModalTarget}
                  onMoveOne={handleMoveOne}
                  onMoveSelected={handleMoveSelected}
                  onRemoveOne={handleRemoveOne}
                  onRemoveSelected={handleRemoveSelected}
                />
              </>
            )}
          </div>
        )}
      </div>

      {addModalTarget && (
        <AddVideosModal
          targetGroup={addModalTarget}
          availableVideos={availableForAdd}
          tags={tags}
          objects={objects}
          series={series}
          tagsById={tagsById}
          ideasById={ideasById}
          onAdd={(videoIds) => addToGroup(addModalTarget, videoIds)}
          onClose={() => setAddModalTarget(null)}
        />
      )}
    </div>
  )
}
