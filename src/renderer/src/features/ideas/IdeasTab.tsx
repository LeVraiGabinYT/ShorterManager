import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { CONTENT_FORMATS } from '@shared/types'
import type { ContentFormat, IdeaStatus, VideoIdea, VideoIdeaInput } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { usePersistedState } from '../../hooks/usePersistedState'
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
import { setLastUsedIdeaFormat } from '../../lib/ideaFormatMemory'
import { toIdeaInput } from '../../lib/ideaInput'
import { ideasWithUpcomingPublishDate, shiftDateByDays } from '../../lib/scheduleShift'
import { BulkActionsBar } from './BulkActionsBar'
import { IdeaFilters } from './IdeaFilters'
import { IdeaFormModal } from './IdeaFormModal'
import { IdeaKanbanBoard } from './IdeaKanbanBoard'
import { IdeaListRow } from './IdeaListRow'

type ViewMode = 'list' | 'kanban'

function isViewMode(value: unknown): value is ViewMode {
  return value === 'list' || value === 'kanban'
}

// Shorts and Vidéos longues are two fully separate tabs now (see VideosTab) — each format gets
// its own filters/sort/view-mode, remembered independently under its own storage key, rather than
// sharing one "Idées" preference set the way a single format toggle used to.
function loadStoredFilters(format: ContentFormat): IdeaFiltersState {
  try {
    const raw = localStorage.getItem(`ideasTab.filters.${format}`)
    return raw ? { ...DEFAULT_IDEA_FILTERS, ...JSON.parse(raw) } : DEFAULT_IDEA_FILTERS
  } catch {
    return DEFAULT_IDEA_FILTERS
  }
}

function loadStoredSort(format: ContentFormat): IdeaSortState {
  try {
    const raw = localStorage.getItem(`ideasTab.sort.${format}`)
    return raw ? { ...DEFAULT_IDEA_SORT, ...JSON.parse(raw) } : DEFAULT_IDEA_SORT
  } catch {
    return DEFAULT_IDEA_SORT
  }
}

interface IdeasTabProps {
  // Which format this instance of the tab manages — Shorts and Vidéos longues render two
  // independent instances of IdeasTab (see VideosTab), each locked to its own format.
  format: ContentFormat
  // Set (e.g. from Vue d'ensemble's "Voir les idées" / "Voir les vidéos en cours" links) to
  // activate the matching quick-filter preset as soon as this tab mounts, instead of whatever was
  // last saved. Consumed once — the caller resets it so a later, unrelated switch back to this
  // tab doesn't re-apply it.
  activateFilterPreset?: 'ideasOnly' | 'inProgress'
  onFilterPresetActivated?: () => void
  // Set (e.g. from an Inspirations node's "Accéder à l'idée" button) to open that idea's edit
  // modal as soon as it's available, instead of requiring the user to find and click it manually.
  // Consumed once, same pattern as activateFilterPreset above.
  openIdeaId?: number | null
  onOpenIdeaConsumed?: () => void
}

export function IdeasTab({
  format,
  activateFilterPreset,
  onFilterPresetActivated,
  openIdeaId,
  onOpenIdeaConsumed
}: IdeasTabProps): ReactElement {
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
  const [filters, setFilters] = useState<IdeaFiltersState>(() => {
    if (activateFilterPreset === 'ideasOnly') {
      return { ...loadStoredFilters(format), statuses: IDEA_ONLY_STATUSES }
    }
    if (activateFilterPreset === 'inProgress') {
      return { ...loadStoredFilters(format), statuses: IN_PROGRESS_STATUSES }
    }
    return loadStoredFilters(format)
  })
  const [sort, setSort] = useState<IdeaSortState>(() =>
    activateFilterPreset === 'inProgress'
      ? { field: 'publishDate', direction: 'desc' }
      : loadStoredSort(format)
  )
  const [viewMode, setViewMode] = usePersistedState<ViewMode>(
    `ideasTab.viewMode.${format}`,
    'list',
    isViewMode
  )
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)
  const [cleaningUp, setCleaningUp] = useState(false)
  const [pendingShift, setPendingShift] = useState<1 | -1 | null>(null)
  const [shifting, setShifting] = useState(false)
  const [shiftMessage, setShiftMessage] = useState<string | null>(null)

  useEffect(() => {
    if (activateFilterPreset) onFilterPresetActivated?.()
    // Only ever meant to run once, right after mount — see the prop's own doc comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!openIdeaId) return
    const idea = ideas.find((i) => i.id === openIdeaId)
    if (idea) {
      setEditingIdea(idea)
      onOpenIdeaConsumed?.()
    }
    // Only re-check when the target id changes or once ideas finish loading — not on every ideas
    // array identity change (a save elsewhere shouldn't re-trigger this).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdeaId, ideas.length])

  useEffect(() => {
    localStorage.setItem(`ideasTab.filters.${format}`, JSON.stringify(filters))
  }, [format, filters])

  useEffect(() => {
    localStorage.setItem(`ideasTab.sort.${format}`, JSON.stringify(sort))
  }, [format, sort])

  // Ideas belonging to the other format never even enter this tab's world — every list, count,
  // filter and bulk action below works off this pre-filtered set, not the full cross-format list.
  const formatIdeas = useMemo(() => ideas.filter((i) => i.format === format), [ideas, format])

  const filteredIdeas = useMemo(
    () =>
      sortIdeas(
        filterIdeas(
          formatIdeas,
          filters,
          objectsById,
          tagsById,
          settings.ruleMissingObjectsPreparation
        ),
        sort
      ),
    [formatIdeas, filters, objectsById, tagsById, settings.ruleMissingObjectsPreparation, sort]
  )
  const unlinkedVideos = useMemo(
    () => publishedVideos.filter((v) => v.ideaId === null),
    [publishedVideos]
  )
  const upcomingIdeas = useMemo(() => ideasWithUpcomingPublishDate(formatIdeas), [formatIdeas])

  async function handleCreate(input: VideoIdeaInput): Promise<void> {
    await window.api.ideas.create(input)
    setLastUsedIdeaFormat(input.format)
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

  const selectedIdeas = formatIdeas.filter((idea) => selectedIds.has(idea.id))

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

  async function handleMoveIdea(idea: VideoIdea, status: IdeaStatus): Promise<void> {
    await window.api.ideas.update(idea.id, { ...toIdeaInput(idea), status })
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

  const formatMeta = CONTENT_FORMATS.find((f) => f.value === format)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-gray-100">
            {formatMeta?.emoji} {formatMeta?.pluralLabel}
          </h1>
          <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Liste
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Kanban
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCleanupDuplicates}
            disabled={cleaningUp}
            title="Fusionne les idées en double et corrige les incohérences de données"
            className="text-sm text-gray-500 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cleaningUp ? 'Mise à jour...' : 'Mettre à jour les données'}
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

      <div
        className={`flex-1 px-6 pb-6 ${viewMode === 'kanban' ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        {loading ? (
          <p className="text-sm text-gray-500">Chargement...</p>
        ) : formatIdeas.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune idée {formatMeta?.pluralLabel.toLowerCase()} pour l’instant. Clique sur «
            Nouvelle idée » pour commencer.
          </p>
        ) : filteredIdeas.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune idée ne correspond à ces filtres.</p>
        ) : viewMode === 'kanban' ? (
          <IdeaKanbanBoard
            ideas={filteredIdeas}
            objectsById={objectsById}
            seriesById={seriesById}
            tagsById={tagsById}
            statusColors={settings.statusColors}
            ruleMissingObjectsPreparation={settings.ruleMissingObjectsPreparation}
            pendingTaskCountByIdeaId={pendingTaskCountByIdeaId}
            publishedVideosByIdeaId={publishedVideosByIdeaId}
            onSelect={setEditingIdea}
            onMove={handleMoveIdea}
          />
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
                  viewCount={publishedVideosByIdeaId.get(idea.id)?.viewCount ?? null}
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
          defaultFormat={format}
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
