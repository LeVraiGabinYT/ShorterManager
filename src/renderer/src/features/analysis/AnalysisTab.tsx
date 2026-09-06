import { useMemo, useState, type ReactElement } from 'react'
import type { PublishedVideo } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import {
  EMPTY_CRITERION,
  ideaMatchesCriterion,
  isCriterionSet,
  videoMatchesCriterion,
  type Criterion
} from '../../lib/analysisFilters'
import { computeVideoStats } from '../../lib/videoStats'
import { AnalysisVideoRow } from './AnalysisVideoRow'
import { ComparisonChart } from './ComparisonChart'
import { CriterionPicker } from './CriterionPicker'
import { DatasetBarChart } from './DatasetBarChart'
import { EvolutionChart, type TimelineEntry } from './EvolutionChart'
import { StatsSummary } from './StatsSummary'
import { TagTrendsPanel } from './TagTrendsPanel'
import { SearchablePicker } from '../../components/SearchablePicker'
import { formatDate } from '../../lib/format'

const DISPLAY_MODES = [
  { id: 'dataset', label: 'Jeu de données' },
  { id: 'evolution', label: 'Évolution dans le temps' },
  { id: 'comparison', label: 'Comparaison' },
  { id: 'trends', label: 'Tendances de chaîne' }
] as const

type DisplayMode = (typeof DISPLAY_MODES)[number]['id']

function criterionLabel(
  criterion: Criterion,
  tagsById: Map<number, { name: string }>,
  objectsById: Map<number, { name: string }>,
  seriesById: Map<number, { name: string }>
): string {
  if (!isCriterionSet(criterion)) return '—'
  if (criterion.type === 'tag') return tagsById.get(Number(criterion.value))?.name ?? '—'
  if (criterion.type === 'object') return objectsById.get(Number(criterion.value))?.name ?? '—'
  if (criterion.type === 'series') return seriesById.get(Number(criterion.value))?.name ?? '—'
  return `« ${criterion.value} »`
}

export function AnalysisTab(): ReactElement {
  const {
    ideas,
    ideasById,
    tags,
    objects,
    series,
    tagsById,
    objectsById,
    seriesById,
    publishedVideos
  } = useIdeasData()
  const [displayMode, setDisplayMode] = useState<DisplayMode>('dataset')

  // Dataset mode state
  const [datasetVideoIds, setDatasetVideoIds] = useState<Set<string>>(new Set())
  const [selectedInDataset, setSelectedInDataset] = useState<Set<string>>(new Set())
  const [keywordInput, setKeywordInput] = useState('')

  // Evolution mode state
  const [evolutionCriterion, setEvolutionCriterion] = useState<Criterion>(EMPTY_CRITERION)

  // Comparison mode state
  const [criterionA, setCriterionA] = useState<Criterion>(EMPTY_CRITERION)
  const [criterionB, setCriterionB] = useState<Criterion>({ type: 'tag', value: '' })

  const datasetVideos = useMemo(
    () => publishedVideos.filter((v) => datasetVideoIds.has(v.youtubeVideoId)),
    [publishedVideos, datasetVideoIds]
  )
  const datasetStats = useMemo(() => computeVideoStats(datasetVideos), [datasetVideos])
  const availableForManualAdd = useMemo(
    () => publishedVideos.filter((v) => !datasetVideoIds.has(v.youtubeVideoId)),
    [publishedVideos, datasetVideoIds]
  )

  const evolutionEntries = useMemo<TimelineEntry[]>(() => {
    if (!isCriterionSet(evolutionCriterion)) return []

    const linkedIdeaIds = new Set(
      publishedVideos.map((v) => v.ideaId).filter((id): id is number => id !== null)
    )

    const published: TimelineEntry[] = publishedVideos
      .filter((v) => videoMatchesCriterion(v, evolutionCriterion, ideasById))
      .map((v) => ({
        key: `video-${v.youtubeVideoId}`,
        date: v.publishedAt,
        kind: 'published',
        title: v.title ?? v.youtubeVideoId,
        emoji: null,
        viewCount: v.viewCount
      }))

    const production: TimelineEntry[] = ideas
      .filter(
        (idea) => ideaMatchesCriterion(idea, evolutionCriterion) && !linkedIdeaIds.has(idea.id)
      )
      .map((idea) => ({
        key: `idea-${idea.id}`,
        date: idea.publishDate ?? idea.shootDate,
        kind: 'production',
        title: idea.title,
        emoji: idea.emoji,
        viewCount: null
      }))

    return [...published, ...production].sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return b.date.localeCompare(a.date)
    })
  }, [evolutionCriterion, publishedVideos, ideas, ideasById])

  const statsA = useMemo(
    () =>
      computeVideoStats(
        publishedVideos.filter((v) => videoMatchesCriterion(v, criterionA, ideasById))
      ),
    [publishedVideos, criterionA, ideasById]
  )
  const statsB = useMemo(
    () =>
      computeVideoStats(
        publishedVideos.filter((v) => videoMatchesCriterion(v, criterionB, ideasById))
      ),
    [publishedVideos, criterionB, ideasById]
  )

  function addVideosToDataset(videos: PublishedVideo[]): void {
    setDatasetVideoIds((prev) => new Set([...prev, ...videos.map((v) => v.youtubeVideoId)]))
  }

  function handleAddByTag(tagId: number): void {
    addVideosToDataset(publishedVideos.filter((v) => v.tagIds.includes(tagId)))
  }

  function handleAddByObject(objectId: number): void {
    addVideosToDataset(
      publishedVideos.filter((v) =>
        videoMatchesCriterion(v, { type: 'object', value: String(objectId) }, ideasById)
      )
    )
  }

  function handleAddBySeries(seriesId: number): void {
    addVideosToDataset(
      publishedVideos.filter((v) =>
        videoMatchesCriterion(v, { type: 'series', value: String(seriesId) }, ideasById)
      )
    )
  }

  function handleAddByKeyword(): void {
    const keyword = keywordInput.trim()
    if (!keyword) return
    addVideosToDataset(
      publishedVideos.filter((v) =>
        videoMatchesCriterion(v, { type: 'keyword', value: keyword }, ideasById)
      )
    )
    setKeywordInput('')
  }

  function toggleDatasetSelection(youtubeVideoId: string): void {
    setSelectedInDataset((prev) => {
      const next = new Set(prev)
      if (next.has(youtubeVideoId)) next.delete(youtubeVideoId)
      else next.add(youtubeVideoId)
      return next
    })
  }

  function handleRemoveSelected(): void {
    setDatasetVideoIds((prev) => {
      const next = new Set(prev)
      for (const id of selectedInDataset) next.delete(id)
      return next
    })
    setSelectedInDataset(new Set())
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Analyse</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {publishedVideos.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune vidéo publiée en cache pour l’instant. Va dans l’onglet « Chaîne YouTube » et
            actualise les vidéos avant de pouvoir les analyser.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-1 rounded-md border border-white/10 bg-white/5 p-1">
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

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              {displayMode === 'dataset' && (
                <div className="space-y-4">
                  <DatasetBarChart videos={datasetVideos} />
                  <StatsSummary stats={datasetStats} />
                </div>
              )}
              {displayMode === 'evolution' && <EvolutionChart entries={evolutionEntries} />}
              {displayMode === 'trends' && (
                <TagTrendsPanel tags={tags} tagsById={tagsById} publishedVideos={publishedVideos} />
              )}
              {displayMode === 'comparison' && (
                <div className="space-y-4">
                  <ComparisonChart
                    labelA={criterionLabel(criterionA, tagsById, objectsById, seriesById)}
                    labelB={criterionLabel(criterionB, tagsById, objectsById, seriesById)}
                    statsA={statsA}
                    statsB={statsB}
                  />
                </div>
              )}
            </div>

            {displayMode === 'dataset' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <h2 className="mb-2 text-sm font-medium text-gray-200">
                    Ajouter des vidéos au jeu de données
                  </h2>

                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-xs text-gray-500">Par tag</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleAddByTag(tag.id)}
                            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                          >
                            + {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {objects.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs text-gray-500">Par objet</p>
                        <div className="flex flex-wrap gap-1.5">
                          {objects.map((obj) => (
                            <button
                              key={obj.id}
                              type="button"
                              onClick={() => handleAddByObject(obj.id)}
                              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                            >
                              + {obj.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {series.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs text-gray-500">Par série</p>
                        <div className="flex flex-wrap gap-1.5">
                          {series.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleAddBySeries(s.id)}
                              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                            >
                              + {s.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="mb-1 text-xs text-gray-500">Par mot-clé</p>
                      <div className="flex gap-2">
                        <input
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddByKeyword()
                            }
                          }}
                          placeholder="Mot-clé dans le titre ou la description..."
                          className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
                        />
                        <button
                          type="button"
                          onClick={handleAddByKeyword}
                          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-xs text-gray-500">Vidéo précise</p>
                      <SearchablePicker
                        items={availableForManualAdd}
                        getKey={(v) => v.youtubeVideoId}
                        getLabel={(v) =>
                          `${v.title ?? v.youtubeVideoId} (${formatDate(v.publishedAt)})`
                        }
                        onSelect={(v) => addVideosToDataset([v])}
                        placeholder="Rechercher une vidéo par titre..."
                        emptyLabel="Toutes les vidéos disponibles sont déjà dans le jeu de données."
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-medium text-gray-200">
                      Vidéos incluses ({datasetVideos.length})
                    </h2>
                    {selectedInDataset.size > 0 && (
                      <button
                        type="button"
                        onClick={handleRemoveSelected}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Retirer la sélection ({selectedInDataset.size})
                      </button>
                    )}
                  </div>

                  {datasetVideos.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Aucune vidéo pour l’instant — ajoute-en avec les outils ci-dessus.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 px-1 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={datasetVideos.every((v) =>
                            selectedInDataset.has(v.youtubeVideoId)
                          )}
                          onChange={(e) =>
                            setSelectedInDataset(
                              e.target.checked
                                ? new Set(datasetVideos.map((v) => v.youtubeVideoId))
                                : new Set()
                            )
                          }
                          className="h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-600"
                        />
                        Tout sélectionner
                      </label>
                      {datasetVideos.map((video) => (
                        <AnalysisVideoRow
                          key={video.youtubeVideoId}
                          video={video}
                          tagsById={tagsById}
                          selected={selectedInDataset.has(video.youtubeVideoId)}
                          onToggle={() => toggleDatasetSelection(video.youtubeVideoId)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {displayMode === 'evolution' && (
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <CriterionPicker
                  label="Voir l’évolution de"
                  tags={tags}
                  objects={objects}
                  series={series}
                  value={evolutionCriterion}
                  onChange={setEvolutionCriterion}
                />
              </div>
            )}

            {displayMode === 'comparison' && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
                <CriterionPicker
                  label="A"
                  tags={tags}
                  objects={objects}
                  series={series}
                  value={criterionA}
                  onChange={setCriterionA}
                />
                <CriterionPicker
                  label="B"
                  tags={tags}
                  objects={objects}
                  series={series}
                  value={criterionB}
                  onChange={setCriterionB}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
