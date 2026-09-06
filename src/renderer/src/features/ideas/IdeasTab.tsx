import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { IdeaStatus, VideoIdea, VideoIdeaInput } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import {
  DEFAULT_IDEA_FILTERS,
  DEFAULT_IDEA_SORT,
  filterIdeas,
  IDEA_ONLY_STATUSES,
  IN_PROGRESS_STATUSES,
  sameStatusSet,
  sortIdeas,
  type IdeaFiltersState,
  type IdeaSortField,
  type IdeaSortState
} from '../../lib/ideaFilters'
import { toIdeaInput } from '../../lib/ideaInput'
import { ideasWithUpcomingPublishDate, shiftDateByDays } from '../../lib/scheduleShift'
import { BulkActionsBar } from './BulkActionsBar'
import { IdeaFilters } from './IdeaFilters'
import { IdeaFormModal } from './IdeaFormModal'
import { IdeaListRow } from './IdeaListRow'

const FILTERS_STORAGE_KEY = 'ideasTab.filters'
const SORT_STORAGE_KEY = 'ideasTab.sort'

function loadStoredFilters(): IdeaFiltersState {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
    return raw ? { ...DEFAULT_IDEA_FILTERS, ...JSON.parse(raw) } : DEFAULT_IDEA_FILTERS
  } catch {
    return DEFAULT_IDEA_FILTERS
  }
}

function loadStoredSort(): IdeaSortState {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY)
    return raw ? { ...DEFAULT_IDEA_SORT, ...JSON.parse(raw) } : DEFAULT_IDEA_SORT
  } catch {
    return DEFAULT_IDEA_SORT
  }
}

export function IdeasTab(): ReactElement {
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
    tasks,
    taskTypes,
    taskTypesById,
    pendingTaskCountByIdeaId,
    settings,
    loading,
    refresh
  } = useIdeasData()
  const [editingIdea, setEditingIdea] = useState<VideoIdea | null>(null)
  const [creating, setCreating] = useState(false)
  const [filters, setFilters] = useState<IdeaFiltersState>(loadStoredFilters)
  const [sort, setSort] = useState<IdeaSortState>(loadStoredSort)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [pendingShift, setPendingShift] = useState<1 | -1 | null>(null)
  const [shifting, setShifting] = useState(false)
  const [shiftMessage, setShiftMessage] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
  }, [filters])

  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort))
  }, [sort])

  const filteredIdeas = useMemo(
    () =>
      sortIdeas(
        filterIdeas(ideas, filters, objectsById, tagsById, settings.ruleMissingObjectsPreparation),
        sort
      ),
    [ideas, filters, objectsById, tagsById, settings.ruleMissingObjectsPreparation, sort]
  )
  const unlinkedVideos = useMemo(
    () => publishedVideos.filter((v) => v.ideaId === null),
    [publishedVideos]
  )
  const upcomingIdeas = useMemo(() => ideasWithUpcomingPublishDate(ideas), [ideas])

  async function handleCreate(input: VideoIdeaInput): Promise<void> {
    await window.api.ideas.create(input)
    setCreating(false)
    await refresh()
  }

  async function handleUpdate(input: VideoIdeaInput): Promise<void> {
    if (!editingIdea) return
    await window.api.ideas.update(editingIdea.id, input)
    setEditingIdea(null)
    await refresh()
  }

  async function handleDelete(): Promise<void> {
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

  function toggleSelect(ideaId: number): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(ideaId)) next.delete(ideaId)
      else next.add(ideaId)
      return next
    })
  }

  const selectedIdeas = ideas.filter((idea) => selectedIds.has(idea.id))

  async function handleBulkAddTag(tagId: number): Promise<void> {
    await Promise.all(
      selectedIdeas
        .filter((idea) => !idea.tagIds.includes(tagId))
        .map((idea) =>
          window.api.ideas.update(idea.id, {
            ...toIdeaInput(idea),
            tagIds: [...idea.tagIds, tagId]
          })
        )
    )
    await refresh()
  }

  async function handleBulkAddObject(objectId: number): Promise<void> {
    await Promise.all(
      selectedIdeas
        .filter((idea) => !idea.objectIds.includes(objectId))
        .map((idea) =>
          window.api.ideas.update(idea.id, {
            ...toIdeaInput(idea),
            objectIds: [...idea.objectIds, objectId]
          })
        )
    )
    await refresh()
  }

  async function handleBulkSetStatus(status: IdeaStatus): Promise<void> {
    await Promise.all(
      selectedIdeas.map((idea) =>
        window.api.ideas.update(idea.id, { ...toIdeaInput(idea), status })
      )
    )
    await refresh()
  }

  async function handleBulkSetSeries(seriesId: number | null): Promise<void> {
    await Promise.all(
      selectedIdeas.map((idea) =>
        window.api.ideas.update(idea.id, { ...toIdeaInput(idea), seriesId })
      )
    )
    await refresh()
  }

  async function handleBulkSetEmoji(emoji: string): Promise<void> {
    await Promise.all(
      selectedIdeas.map((idea) => window.api.ideas.update(idea.id, { ...toIdeaInput(idea), emoji }))
    )
    await refresh()
  }

  async function handleBulkDelete(): Promise<void> {
    await Promise.all(selectedIdeas.map((idea) => window.api.ideas.remove(idea.id)))
    setSelectedIds(new Set())
    await refresh()
  }

  function handleShowInProgress(): void {
    setFilters((prev) => ({ ...prev, statuses: IN_PROGRESS_STATUSES }))
    setSort({ field: 'publishDate', direction: 'desc' })
  }

  function handleShowIdeasOnly(): void {
    setFilters((prev) => ({ ...prev, statuses: IDEA_ONLY_STATUSES }))
  }

  function handleClearFilters(): void {
    setFilters(DEFAULT_IDEA_FILTERS)
  }

  const isInProgressActive = sameStatusSet(filters.statuses, IN_PROGRESS_STATUSES)
  const isIdeasOnlyActive = sameStatusSet(filters.statuses, IDEA_ONLY_STATUSES)

  async function handleCleanupDuplicates(): Promise<void> {
    setCleaningUp(true)
    const result = await window.api.ideas.mergeDuplicates()
    setCleaningUp(false)
    const parts: string[] = []
    parts.push(
      result.mergedGroups === 0
        ? 'Aucun doublon trouvé.'
        : `${result.mergedGroups} groupe(s) de doublons fusionné(s), ${result.removedIdeas} idée(s) retirée(s).`
    )
    if (result.backfilledShootDates > 0) {
      parts.push(
        `${result.backfilledShootDates} date(s) de tournage manquante(s) complétée(s) avec la date de publication.`
      )
    }
    setCleanupResult(parts.join(' '))
    await refresh()
  }

  async function handleShiftSchedule(days: 1 | -1): Promise<void> {
    setShifting(true)
    await Promise.all(
      upcomingIdeas.map((idea) =>
        window.api.ideas.update(idea.id, {
          ...toIdeaInput(idea),
          publishDate: shiftDateByDays(idea.publishDate as string, days)
        })
      )
    )
    setShifting(false)
    setPendingShift(null)
    setShiftMessage(
      `${upcomingIdeas.length} idée${upcomingIdeas.length > 1 ? 's' : ''} décalée${
        upcomingIdeas.length > 1 ? 's' : ''
      } de ${days > 0 ? '+1' : '-1'} jour.`
    )
    await refresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Idées de vidéos</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCleanupDuplicates}
            disabled={cleaningUp}
            className="text-sm text-gray-500 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cleaningUp ? 'Nettoyage...' : 'Nettoyer les doublons'}
          </button>

          {pendingShift === null ? (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-gray-500">Décaler le planning</span>
              <button
                type="button"
                onClick={() => setPendingShift(-1)}
                disabled={upcomingIdeas.length === 0}
                title="Décaler toutes les publications futures d’un jour en arrière"
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                −1j
              </button>
              <button
                type="button"
                onClick={() => setPendingShift(1)}
                disabled={upcomingIdeas.length === 0}
                title="Décaler toutes les publications futures d’un jour en avant"
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +1j
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-amber-300">
                Décaler {upcomingIdeas.length} idée{upcomingIdeas.length > 1 ? 's' : ''} de{' '}
                {pendingShift > 0 ? '+1' : '-1'} jour ?
              </span>
              <button
                type="button"
                onClick={() => handleShiftSchedule(pendingShift)}
                disabled={shifting}
                className="rounded bg-blue-600 px-2 py-1 font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {shifting ? 'Décalage...' : 'Confirmer'}
              </button>
              <button
                type="button"
                onClick={() => setPendingShift(null)}
                disabled={shifting}
                className="text-gray-400 hover:text-gray-200"
              >
                Annuler
              </button>
            </div>
          )}

          <button
            onClick={() => setCreating(true)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            + Nouvelle idée
          </button>
        </div>
      </div>

      {cleanupResult && (
        <div className="px-6 pb-2">
          <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
            {cleanupResult}
          </p>
        </div>
      )}

      {shiftMessage && (
        <div className="px-6 pb-2">
          <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
            {shiftMessage}
          </p>
        </div>
      )}

      <div className="space-y-3 px-6 pb-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <IdeaFilters
              filters={filters}
              onChange={setFilters}
              tags={tags}
              objects={objects}
              series={series}
            />
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleShowInProgress}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                isInProgressActive
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                  : 'border-white/10 text-gray-400 hover:text-gray-200'
              }`}
            >
              En cours
            </button>
            <button
              type="button"
              onClick={handleShowIdeasOnly}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                isIdeasOnlyActive
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                  : 'border-white/10 text-gray-400 hover:text-gray-200'
              }`}
            >
              Idées
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
            >
              Tout afficher
            </button>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <BulkActionsBar
            selectedCount={selectedIds.size}
            tags={tags}
            objects={objects}
            series={series}
            onAddTag={handleBulkAddTag}
            onAddObject={handleBulkAddObject}
            onSetStatus={handleBulkSetStatus}
            onSetSeries={handleBulkSetSeries}
            onSetEmoji={handleBulkSetEmoji}
            onDelete={handleBulkDelete}
            onClear={() => setSelectedIds(new Set())}
            onTagsChanged={refresh}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : ideas.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune idée pour l’instant. Clique sur « Nouvelle idée » pour commencer.
          </p>
        ) : filteredIdeas.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune idée ne correspond à ces filtres.</p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between px-1">
              <label className="flex items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={filteredIdeas.every((i) => selectedIds.has(i.id))}
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked ? new Set(filteredIdeas.map((i) => i.id)) : new Set()
                    )
                  }
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-600"
                />
                Tout sélectionner ({filteredIdeas.length})
              </label>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                Trier par
                <select
                  value={sort.field}
                  onChange={(e) =>
                    setSort((prev) => ({ ...prev, field: e.target.value as IdeaSortField }))
                  }
                  className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-gray-300 outline-none"
                >
                  <option value="default" className="bg-[#15161a]">
                    Par défaut
                  </option>
                  <option value="shootDate" className="bg-[#15161a]">
                    Date de tournage
                  </option>
                  <option value="publishDate" className="bg-[#15161a]">
                    Date de publication
                  </option>
                </select>
                {sort.field !== 'default' && (
                  <button
                    type="button"
                    onClick={() =>
                      setSort((prev) => ({
                        ...prev,
                        direction: prev.direction === 'asc' ? 'desc' : 'asc'
                      }))
                    }
                    className="rounded border border-white/10 px-1.5 py-0.5 text-gray-300 hover:bg-white/5"
                  >
                    {sort.direction === 'asc' ? '↑ Croissant' : '↓ Décroissant'}
                  </button>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03]">
              {filteredIdeas.map((idea) => (
                <IdeaListRow
                  key={idea.id}
                  idea={idea}
                  objectsById={objectsById}
                  seriesById={seriesById}
                  tagsById={tagsById}
                  statusColors={settings.statusColors}
                  showTags={settings.showTagsOnIdeaCard}
                  ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
                  pendingTaskCount={pendingTaskCountByIdeaId.get(idea.id) ?? 0}
                  selected={selectedIds.has(idea.id)}
                  onToggleSelect={() => toggleSelect(idea.id)}
                  onClick={() => setEditingIdea(idea)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {creating && (
        <IdeaFormModal
          idea={null}
          objects={objects}
          tags={tags}
          series={series}
          existingIdeas={ideas}
          linkedVideo={null}
          unlinkedVideos={unlinkedVideos}
          onClose={() => setCreating(false)}
          onSave={handleCreate}
          ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
          onTagsChanged={refresh}
          onSeriesChanged={refresh}
          onLinkVideo={() => {}}
          onUnlinkVideo={() => {}}
        />
      )}

      {editingIdea && (
        <IdeaFormModal
          idea={editingIdea}
          objects={objects}
          tags={tags}
          series={series}
          existingIdeas={ideas}
          linkedVideo={publishedVideosByIdeaId.get(editingIdea.id) ?? null}
          unlinkedVideos={unlinkedVideos}
          tasks={tasks}
          taskTypes={taskTypes}
          taskTypesById={taskTypesById}
          statusColors={settings.statusColors}
          onTasksChanged={refresh}
          onClose={() => setEditingIdea(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
          ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
          onTagsChanged={refresh}
          onSeriesChanged={refresh}
          onLinkVideo={handleLinkVideo}
          onUnlinkVideo={handleUnlinkVideo}
        />
      )}
    </div>
  )
}
