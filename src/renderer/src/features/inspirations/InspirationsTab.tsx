import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent
} from 'react'
import type {
  BackupMode,
  IdeaStatus,
  Inspiration,
  InspirationBoard,
  InspirationGroup,
  InspirationGroupInput,
  InspirationInput,
  InspirationKind,
  InspirationLink
} from '@shared/types'
import { DEFAULT_STATUS_COLORS, IDEA_STATUSES, TAG_COLOR_PRESETS } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { usePersistedState } from '../../hooks/usePersistedState'
import { getEffectiveStatus } from '../../lib/ideaStatus'
import { InspirationGroupFrame } from './InspirationGroupFrame'
import { InspirationNode } from './InspirationNode'
import { InspirationPanel } from './InspirationPanel'

const DEFAULT_PANEL_WIDTH = 384
const MIN_PANEL_WIDTH = 280
const MAX_PANEL_WIDTH = 720

// Tags a copy/paste payload as ours (rather than arbitrary clipboard text) — both for a
// within-board paste and a paste onto a completely different board or a different mind map
// altogether (the payload carries full card content, not ids, so it's portable).
const CLIPBOARD_MARKER = 'shortermanager-inspirations-clipboard-v1'

interface InspirationClipboardPayload {
  marker: typeof CLIPBOARD_MARKER
  inspirations: Inspiration[]
  groups: InspirationGroup[]
  links: InspirationLink[]
}

export interface LinkedIdeaSummary {
  ideaId: number
  title: string
  status: IdeaStatus
  statusLabel: string
  statusColor: string
  viewCount: number | null
  likeCount: number | null
  commentCount: number | null
}

// A true infinite canvas: node positions live in unbounded "world" coordinates, and the visible
// viewport is just a `translate(pan) scale(zoom)` window onto that world — panning drags the
// world under a fixed-size viewport (overflow-hidden, no scrollbars) instead of scrolling a
// finite-size container.
const MIN_ZOOM = 0.2
const MAX_ZOOM = 2.5
const GRID_SIZE = 24

// Used to anchor a connection line before a node's real size has been measured yet (see
// nodeSizes/ResizeObserver below) — close enough to the default card size that the line doesn't
// visibly jump once the real measurement arrives. In world units, unaffected by zoom (a CSS scale
// transform doesn't change what ResizeObserver reports as an element's own layout size).
const FALLBACK_NODE_SIZE = { width: 180, height: 60 }

type DragState =
  // Moves any combination of nodes and groups together in one gesture — dragging a group also
  // carries whatever nodes currently sit inside its bounds (see nodesInsideGroup), and dragging
  // any node/group that's part of a bigger multi-selection carries the whole selection (see
  // computeDragSelection).
  | {
      type: 'move'
      nodeIds: number[]
      groupIds: number[]
      startClientX: number
      startClientY: number
      nodeOrigins: Record<number, { x: number; y: number }>
      groupOrigins: Record<number, { x: number; y: number }>
    }
  | { type: 'link'; fromId: number }
  | {
      type: 'pan'
      startClientX: number
      startClientY: number
      startPanX: number
      startPanY: number
    }
  | { type: 'select' }
  | {
      type: 'group-resize'
      id: number
      startClientX: number
      startClientY: number
      originWidth: number
      originHeight: number
    }
  | null

interface UndoAction {
  undo: () => Promise<void> | void
  redo: () => Promise<void> | void
}

function toInspirationInput(insp: Inspiration, boardId: number = insp.boardId): InspirationInput {
  return {
    boardId,
    kind: insp.kind,
    title: insp.title,
    emoji: insp.emoji,
    descriptionHtml: insp.descriptionHtml,
    videoUrl: insp.videoUrl,
    videoThumbnailUrl: insp.videoThumbnailUrl,
    backgroundColor: insp.backgroundColor,
    fontColor: insp.fontColor,
    fontSize: insp.fontSize,
    linkedIdeaId: insp.linkedIdeaId,
    posX: insp.posX,
    posY: insp.posY,
    videos: insp.videos.map((v) => ({ url: v.url, label: v.label })),
    objects: insp.objects.map((o) => ({ name: o.name, link: o.link })),
    details: insp.details.map((d) => ({ name: d.name, type: d.type, value: d.value }))
  }
}

function toGroupInput(
  group: InspirationGroup,
  boardId: number = group.boardId
): InspirationGroupInput {
  return {
    boardId,
    title: group.title,
    color: group.color,
    posX: group.posX,
    posY: group.posY,
    width: group.width,
    height: group.height
  }
}

function isEditableTarget(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  )
}

// Remembers each board's own pan/zoom so switching tabs (this whole component unmounts and
// remounts) or switching between boards comes back to the same view instead of resetting to the
// origin. Deliberately bypasses React state/usePersistedState for this: the value that matters
// most is the very last one, captured on unmount — a state-update-then-effect-writes chain isn't
// guaranteed to finish before the component tears down, so this reads/writes localStorage
// directly instead, kept in a plain ref for reads in between.
type BoardView = { x: number; y: number; zoom: number }
const VIEW_BY_BOARD_STORAGE_KEY = 'inspirations-view-by-board'

function loadViewByBoard(): Record<number, BoardView> {
  try {
    const raw = localStorage.getItem(VIEW_BY_BOARD_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<number, BoardView>) : {}
  } catch {
    return {}
  }
}

function saveViewByBoard(map: Record<number, BoardView>): void {
  try {
    localStorage.setItem(VIEW_BY_BOARD_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // localStorage unavailable/full — losing the "last view per board" memory isn't critical.
  }
}

function AddVideoNodeModal({
  onCancel,
  onSubmit,
  submitting,
  error
}: {
  onCancel: () => void
  onSubmit: (url: string) => void
  submitting: boolean
  error: string | null
}): ReactElement {
  const [url, setUrl] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#15161a] p-5 shadow-2xl">
        <h2 className="text-sm font-semibold text-gray-100">Ajouter une vidéo YouTube</h2>
        <p className="mt-1 text-xs text-gray-400">Lien d’un Short ou d’une vidéo longue.</p>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && url.trim()) onSubmit(url.trim())
          }}
          placeholder="https://www.youtube.com/shorts/..."
          className="mt-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60"
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={submitting || !url.trim()}
            onClick={() => onSubmit(url.trim())}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Vérification...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

export type ImportBoardTarget = 'merge' | 'replace' | 'new'

function ImportBoardModal({
  fileName,
  currentBoardName,
  onCancel,
  onConfirm,
  importing
}: {
  fileName: string
  currentBoardName: string
  onCancel: () => void
  onConfirm: (target: ImportBoardTarget) => void
  importing: boolean
}): ReactElement {
  const [target, setTarget] = useState<ImportBoardTarget>('new')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#15161a] p-5 shadow-2xl">
        <h2 className="text-sm font-semibold text-gray-100">Importer « {fileName} »</h2>

        <div className="mt-4 space-y-3">
          <label
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors ${
              target === 'new'
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <input
              type="radio"
              name="import-board-target"
              checked={target === 'new'}
              onChange={() => setTarget('new')}
              className="mt-0.5 accent-blue-600"
            />
            <span>
              <span className="block font-medium text-gray-100">Nouveau mind map</span>
              <span className="block text-xs text-gray-400">
                Crée un nouvel onglet mind map et y importe tout le contenu du fichier.
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors ${
              target === 'merge'
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <input
              type="radio"
              name="import-board-target"
              checked={target === 'merge'}
              onChange={() => setTarget('merge')}
              className="mt-0.5 accent-blue-600"
            />
            <span>
              <span className="block font-medium text-gray-100">
                Fusionner dans « {currentBoardName} »
              </span>
              <span className="block text-xs text-gray-400">
                Ajoute toutes les cartes du fichier comme nouvelles dans le mind map actuellement
                ouvert, sans toucher au reste.
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors ${
              target === 'replace'
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <input
              type="radio"
              name="import-board-target"
              checked={target === 'replace'}
              onChange={() => setTarget('replace')}
              className="mt-0.5 accent-red-600"
            />
            <span>
              <span className="block font-medium text-gray-100">
                Remplacer « {currentBoardName} »
              </span>
              <span className="block text-xs text-gray-400">
                Efface le mind map actuellement ouvert et le remplace par celui du fichier.
                Irréversible.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={importing}
            className="rounded-md px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(target)}
            disabled={importing}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? 'Import...' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface InspirationsTabProps {
  onNavigateToIdea: (ideaId: number) => void
}

export function InspirationsTab({ onNavigateToIdea }: InspirationsTabProps): ReactElement {
  const { ideas, objectsById, publishedVideosByIdeaId, settings: ideasSettings } = useIdeasData()

  const [boards, setBoards] = useState<InspirationBoard[]>([])
  const [boardsLoaded, setBoardsLoaded] = useState(false)
  // Persisted so re-opening the tab (or the app) comes back to whichever board was last open —
  // validated against the actually-loaded boards below since a persisted id can point at a board
  // deleted in the meantime.
  const [persistedBoardId, setPersistedBoardId] = usePersistedState<number | null>(
    'inspirations-active-board',
    null,
    (v): v is number | null => v === null || typeof v === 'number'
  )
  const [activeBoardId, setActiveBoardIdState] = useState<number | null>(null)
  const activeBoardIdRef = useRef(activeBoardId)
  useEffect(() => {
    activeBoardIdRef.current = activeBoardId
  }, [activeBoardId])

  function setActiveBoardId(id: number): void {
    setActiveBoardIdState(id)
    setPersistedBoardId(id)
  }

  async function refreshBoards(): Promise<void> {
    const list = await window.api.inspirations.listBoards()
    setBoards(list)
    setBoardsLoaded(true)
    const stillExists = list.some((b) => b.id === activeBoardIdRef.current)
    if (!stillExists) {
      const fallback = list.find((b) => b.id === persistedBoardId) ?? list[0] ?? null
      if (fallback) setActiveBoardId(fallback.id)
    }
  }

  useEffect(() => {
    refreshBoards()
    // Only ever meant to run once on mount — refreshBoards() itself is stable (reads via refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const boardRenameTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  function handleRenameBoard(id: number, name: string): void {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)))
    const existing = boardRenameTimers.current.get(id)
    if (existing) clearTimeout(existing)
    boardRenameTimers.current.set(
      id,
      setTimeout(() => {
        void window.api.inspirations.renameBoard(id, name)
      }, 500)
    )
  }

  async function handleAddBoard(): Promise<void> {
    const created = await window.api.inspirations.createBoard(`Mind map ${boards.length + 1}`)
    setBoards((prev) => [...prev, created])
    setActiveBoardId(created.id)
  }

  async function handleDeleteBoard(id: number): Promise<void> {
    const ok = await window.api.inspirations.removeBoard(id)
    if (!ok) {
      setBoardStatusMessage('Impossible de supprimer le dernier mind map restant.')
      return
    }
    const remaining = boards.filter((b) => b.id !== id)
    setBoards(remaining)
    if (activeBoardIdRef.current === id && remaining[0]) setActiveBoardId(remaining[0].id)
  }

  const [inspirations, setInspirations] = useState<Inspiration[]>([])
  const [links, setLinks] = useState<InspirationLink[]>([])
  const [groups, setGroups] = useState<InspirationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<number>>(new Set())
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set())

  // Ref mirrors of the state above — read from inside handlers that must stay correct even when
  // called from a stale closure (the keydown shortcut effect below only attaches once, and undo/
  // redo entries can fire long after the render that created them).
  const inspirationsRef = useRef(inspirations)
  useEffect(() => {
    inspirationsRef.current = inspirations
  }, [inspirations])
  const linksRef = useRef(links)
  useEffect(() => {
    linksRef.current = links
  }, [links])
  const groupsRef = useRef(groups)
  useEffect(() => {
    groupsRef.current = groups
  }, [groups])
  const multiSelectedIdsRef = useRef(multiSelectedIds)
  useEffect(() => {
    multiSelectedIdsRef.current = multiSelectedIds
  }, [multiSelectedIds])
  const selectedGroupIdsRef = useRef(selectedGroupIds)
  useEffect(() => {
    selectedGroupIdsRef.current = selectedGroupIds
  }, [selectedGroupIds])

  // Position overrides applied while a node/group is being dragged (and briefly after, until the
  // DB round-trip lands) — kept separate from `inspirations`/`groups` so a mid-drag position never
  // has to be written back through the full update() shape, only the lightweight position call.
  const [livePositions, setLivePositions] = useState<Record<number, { x: number; y: number }>>({})
  const livePositionsRef = useRef(livePositions)
  useEffect(() => {
    livePositionsRef.current = livePositions
  }, [livePositions])
  const [groupLivePositions, setGroupLivePositions] = useState<
    Record<number, { x: number; y: number }>
  >({})
  const groupLivePositionsRef = useRef(groupLivePositions)
  useEffect(() => {
    groupLivePositionsRef.current = groupLivePositions
  }, [groupLivePositions])
  const [groupLiveSizes, setGroupLiveSizes] = useState<
    Record<number, { width: number; height: number }>
  >({})
  const groupLiveSizesRef = useRef(groupLiveSizes)
  useEffect(() => {
    groupLiveSizesRef.current = groupLiveSizes
  }, [groupLiveSizes])

  const [nodeSizes, setNodeSizes] = useState<Map<number, { width: number; height: number }>>(
    new Map()
  )
  const nodeSizesRef = useRef(nodeSizes)
  useEffect(() => {
    nodeSizesRef.current = nodeSizes
  }, [nodeSizes])
  const nodeElements = useRef<Map<number, HTMLDivElement>>(new Map())
  const resizeObserver = useRef<ResizeObserver | null>(null)

  const [drag, setDrag] = useState<DragState>(null)
  const [liveLinkPoint, setLiveLinkPoint] = useState<{ x: number; y: number } | null>(null)
  const [selectionRect, setSelectionRect] = useState<{
    start: { x: number; y: number }
    current: { x: number; y: number }
  } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  // Set once an in-progress empty-space drag (pan or rubber-band select) has actually moved the
  // mouse a few pixels — lets the canvas's onClick (which normally deselects) tell a real drag
  // gesture apart from a plain click on empty space.
  const didDragRef = useRef(false)

  // The world -> screen transform: translate(pan) scale(zoom), applied to the world div (see
  // render). Mirrored into refs so drag/wheel handlers (attached via effects that don't re-run on
  // every pan/zoom change) always read the latest values instead of a stale closure.
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  useEffect(() => {
    panRef.current = pan
  }, [pan])
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const viewByBoardRef = useRef<Record<number, BoardView>>(loadViewByBoard())
  const viewedBoardIdRef = useRef<number | null>(null)

  function saveCurrentView(boardId: number | null): void {
    if (boardId === null) return
    viewByBoardRef.current = {
      ...viewByBoardRef.current,
      [boardId]: { x: panRef.current.x, y: panRef.current.y, zoom: zoomRef.current }
    }
    saveViewByBoard(viewByBoardRef.current)
  }

  // Switching boards: save the view of whichever board we're leaving, then restore (or, the
  // first time, default to) the one we're entering.
  useEffect(() => {
    if (activeBoardId === null) return
    if (viewedBoardIdRef.current !== null && viewedBoardIdRef.current !== activeBoardId) {
      saveCurrentView(viewedBoardIdRef.current)
    }
    const saved = viewByBoardRef.current[activeBoardId]
    setPan(saved ? { x: saved.x, y: saved.y } : { x: 0, y: 0 })
    setZoom(saved ? saved.zoom : 1)
    viewedBoardIdRef.current = activeBoardId
  }, [activeBoardId])

  // Switching app tabs away from Inspirations entirely unmounts this component — flush whatever
  // board is currently open's view right before that happens.
  useEffect(() => {
    return () => saveCurrentView(viewedBoardIdRef.current)
  }, [])

  // Only true briefly after a programmatic "jump" (search focus, fit view, reset zoom) — adds a
  // CSS transition so the jump animates, while normal drag-panning/wheel-zooming stay transition-
  // free (instant, so they never lag behind the mouse).
  const [animatingFocus, setAnimatingFocus] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const snapToGridRef = useRef(snapToGrid)
  useEffect(() => {
    snapToGridRef.current = snapToGrid
  }, [snapToGrid])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [videoPromptOpen, setVideoPromptOpen] = useState(false)
  const [addingVideo, setAddingVideo] = useState(false)
  const [addVideoError, setAddVideoError] = useState<string | null>(null)

  const [pendingImportFile, setPendingImportFile] = useState<string | null>(null)
  const [importingBoard, setImportingBoard] = useState(false)
  const [boardStatusMessage, setBoardStatusMessage] = useState<string | null>(null)

  // The properties panel's width — persisted across selecting/deselecting cards and across tab
  // switches (this component unmounts entirely when leaving the Inspirations tab), the same
  // localStorage-backed pattern already used elsewhere in the app for "remember where I was" UI
  // state. `resizingWidth` holds the live value only while actively dragging the divider; the
  // persisted value is only written once on release, so a fast drag doesn't spam localStorage.
  const [panelWidth, setPanelWidth] = usePersistedState<number>(
    'inspirations-panel-width',
    DEFAULT_PANEL_WIDTH,
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  )
  const [resizingPanel, setResizingPanel] = useState(false)
  const [resizingWidth, setResizingWidth] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function handlePanelResizeMouseDown(e: ReactMouseEvent): void {
    e.preventDefault()
    setResizingPanel(true)
  }

  useEffect(() => {
    if (!resizingPanel) return

    function handleMouseMove(e: MouseEvent): void {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const next = Math.min(
        Math.max(rect.right - e.clientX, MIN_PANEL_WIDTH),
        Math.min(MAX_PANEL_WIDTH, rect.width * 0.7)
      )
      setResizingWidth(next)
    }
    function handleMouseUp(): void {
      setResizingPanel(false)
      setResizingWidth((current) => {
        if (current !== null) setPanelWidth(current)
        return null
      })
    }

    const previousCursor = document.body.style.cursor
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.body.style.cursor = previousCursor
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingPanel, setPanelWidth])

  // --- Undo/redo -----------------------------------------------------------------------------
  // Covers structural actions on the board (create/delete/move/duplicate a card, create/remove a
  // link, create/delete/move/resize/recolor a group). Deliberately does NOT cover in-panel text
  // edits (title/description/custom fields) — those already autosave continuously, and hooking
  // per-keystroke changes into this stack would be both fragile and not what Ctrl+Z usually means
  // in a tool like this one.
  const undoStack = useRef<UndoAction[]>([])
  const redoStack = useRef<UndoAction[]>([])

  function pushUndo(action: UndoAction): void {
    undoStack.current.push(action)
    redoStack.current = []
    if (undoStack.current.length > 60) undoStack.current.shift()
  }

  async function handleUndo(): Promise<void> {
    const action = undoStack.current.pop()
    if (!action) return
    await action.undo()
    redoStack.current.push(action)
  }

  async function handleRedo(): Promise<void> {
    const action = redoStack.current.pop()
    if (!action) return
    await action.redo()
    undoStack.current.push(action)
  }

  async function refresh(): Promise<void> {
    const boardId = activeBoardIdRef.current
    if (boardId === null) return
    setLoading(true)
    const [list, linkList, groupList] = await Promise.all([
      window.api.inspirations.list(boardId),
      window.api.inspirations.listLinks(boardId),
      window.api.inspirations.listGroups(boardId)
    ])
    // The active board may have changed again while this fetch was in flight — don't clobber
    // whatever board the user's already looking at with a stale response.
    if (activeBoardIdRef.current !== boardId) return
    setInspirations(list)
    setLinks(linkList)
    setGroups(groupList)
    setLoading(false)
  }

  // Re-fetches whenever the active board changes (including the very first time it's resolved
  // from boardsLoaded/persistedBoardId above) — clears the previous board's cards immediately so
  // switching tabs never briefly shows the wrong board's content.
  useEffect(() => {
    if (activeBoardId === null) return
    setInspirations([])
    setLinks([])
    setGroups([])
    clearSelection()
    void refresh()
  }, [activeBoardId])

  useEffect(() => {
    resizeObserver.current = new ResizeObserver((entries) => {
      setNodeSizes((prev) => {
        const next = new Map(prev)
        for (const entry of entries) {
          const idAttr = (entry.target as HTMLElement).dataset.inspirationId
          if (!idAttr) continue
          next.set(Number(idAttr), {
            width: entry.contentRect.width,
            height: entry.contentRect.height
          })
        }
        return next
      })
    })
    return () => resizeObserver.current?.disconnect()
  }, [])

  function registerNodeElement(id: number, el: HTMLDivElement | null): void {
    const previous = nodeElements.current.get(id)
    if (previous && previous !== el) resizeObserver.current?.unobserve(previous)
    if (el) {
      nodeElements.current.set(id, el)
      resizeObserver.current?.observe(el)
    } else {
      nodeElements.current.delete(id)
    }
  }

  const selected = inspirations.find((i) => i.id === selectedId) ?? null

  function positionOf(id: number): { x: number; y: number } {
    const inspiration = inspirations.find((i) => i.id === id)
    return livePositions[id] ?? { x: inspiration?.posX ?? 0, y: inspiration?.posY ?? 0 }
  }

  function centerOf(id: number): { x: number; y: number } {
    const pos = positionOf(id)
    const size = nodeSizes.get(id) ?? FALLBACK_NODE_SIZE
    return { x: pos.x + size.width / 2, y: pos.y + size.height / 2 }
  }

  function groupPositionOf(id: number): { x: number; y: number } {
    const group = groups.find((g) => g.id === id)
    return groupLivePositions[id] ?? { x: group?.posX ?? 0, y: group?.posY ?? 0 }
  }

  function groupSizeOf(id: number): { width: number; height: number } {
    const group = groups.find((g) => g.id === id)
    return groupLiveSizes[id] ?? { width: group?.width ?? 320, height: group?.height ?? 240 }
  }

  function snapValue(v: number): number {
    return snapToGridRef.current ? Math.round(v / GRID_SIZE) * GRID_SIZE : v
  }

  // Never stored on the inspiration row beyond the plain linkedIdeaId — resolved live from the
  // exact same ideas/objects/publishedVideos data every other tab reads (useIdeasData() above),
  // so a channel stats refresh (or an idea's status changing) shows up here immediately, on every
  // board, with zero extra sync step.
  function getLinkedIdeaSummary(linkedIdeaId: number | null): LinkedIdeaSummary | null {
    if (linkedIdeaId === null) return null
    const idea = ideas.find((i) => i.id === linkedIdeaId)
    if (!idea) return null
    const effective = getEffectiveStatus(
      idea,
      objectsById,
      ideasSettings.ruleMissingObjectsPreparation
    )
    const statusMeta = IDEA_STATUSES.find((s) => s.value === effective.status)
    const video = publishedVideosByIdeaId.get(idea.id)
    return {
      ideaId: idea.id,
      title: idea.title,
      status: effective.status,
      statusLabel: statusMeta?.label ?? effective.status,
      statusColor:
        ideasSettings.statusColors[effective.status] ?? DEFAULT_STATUS_COLORS[effective.status],
      viewCount: video?.viewCount ?? null,
      likeCount: video?.likeCount ?? null,
      commentCount: video?.commentCount ?? null
    }
  }

  // A node is "in" a group simply by having its center inside the group's current bounds — no
  // membership list, purely geometric (see InspirationGroupFrame). Recomputed fresh every time a
  // group-drag starts, so it always reflects whatever's actually inside the frame right now.
  function nodesInsideGroup(group: InspirationGroup): number[] {
    const pos = groupLivePositionsRef.current[group.id] ?? { x: group.posX, y: group.posY }
    const size = groupLiveSizesRef.current[group.id] ?? { width: group.width, height: group.height }
    return inspirationsRef.current
      .filter((insp) => {
        const nodePos = livePositionsRef.current[insp.id] ?? { x: insp.posX, y: insp.posY }
        const nodeSize = nodeSizesRef.current.get(insp.id) ?? FALLBACK_NODE_SIZE
        const centerX = nodePos.x + nodeSize.width / 2
        const centerY = nodePos.y + nodeSize.height / 2
        return (
          centerX >= pos.x &&
          centerX <= pos.x + size.width &&
          centerY >= pos.y &&
          centerY <= pos.y + size.height
        )
      })
      .map((insp) => insp.id)
  }

  // A group is "inside" another one only when its ENTIRE rectangle sits within the container's —
  // a full-containment test (unlike nodesInsideGroup's center-point one), matching "un encadré qui
  // encadre TOUT un ou plusieurs autres". Nested groups need no recursive expansion: if C sits
  // fully inside B which sits fully inside A, C is by simple geometry also fully inside A, so a
  // direct bounds check against the top dragged group already finds every group (and, via
  // nodesInsideGroup below, every card) nested at any depth.
  function groupsInsideGroup(container: InspirationGroup): number[] {
    const pos = groupLivePositionsRef.current[container.id] ?? {
      x: container.posX,
      y: container.posY
    }
    const size = groupLiveSizesRef.current[container.id] ?? {
      width: container.width,
      height: container.height
    }
    return groupsRef.current
      .filter((g) => {
        if (g.id === container.id) return false
        const gPos = groupLivePositionsRef.current[g.id] ?? { x: g.posX, y: g.posY }
        const gSize = groupLiveSizesRef.current[g.id] ?? { width: g.width, height: g.height }
        return (
          gPos.x >= pos.x &&
          gPos.y >= pos.y &&
          gPos.x + gSize.width <= pos.x + size.width &&
          gPos.y + gSize.height <= pos.y + size.height
        )
      })
      .map((g) => g.id)
  }

  // Resolves what a drag started on one node/group should actually move: just that item (plus,
  // for a group, whatever nodes AND other groups currently sit inside it) when it isn't part of a
  // bigger selection, or the WHOLE current selection (every selected node and group, each group
  // still carrying its own contents) when it is — so dragging any one selected item moves
  // everything together, and dragging a group that encloses other groups carries them all along
  // exactly like it does for cards.
  function computeDragSelection(
    kind: 'node' | 'group',
    id: number
  ): { nodeIds: number[]; groupIds: number[]; isActiveSelection: boolean } {
    const totalSelected = multiSelectedIdsRef.current.size + selectedGroupIdsRef.current.size
    const isActiveSelection =
      totalSelected > 1 &&
      (kind === 'node' ? multiSelectedIdsRef.current.has(id) : selectedGroupIdsRef.current.has(id))

    const nodeIds = new Set<number>(
      isActiveSelection ? multiSelectedIdsRef.current : kind === 'node' ? [id] : []
    )
    const groupIds = isActiveSelection
      ? Array.from(selectedGroupIdsRef.current)
      : kind === 'group'
        ? (() => {
            const group = groupsRef.current.find((g) => g.id === id)
            return group ? [id, ...groupsInsideGroup(group)] : [id]
          })()
        : []

    for (const gid of groupIds) {
      const group = groupsRef.current.find((g) => g.id === gid)
      if (group) for (const nid of nodesInsideGroup(group)) nodeIds.add(nid)
    }

    return { nodeIds: Array.from(nodeIds), groupIds, isActiveSelection }
  }

  // Screen (viewport-relative client coords) -> world coords, inverting the world div's
  // translate(pan) scale(zoom) transform. Reads pan/zoom from refs (not state) so it stays
  // correct even called from within event handlers attached by an effect that hasn't re-run yet.
  function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const el = viewportRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current
    }
  }

  function viewCenterWorld(): { x: number; y: number } {
    const el = viewportRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  function selectSingle(id: number): void {
    setSelectedId(id)
    setMultiSelectedIds(new Set([id]))
    setSelectedGroupIds(new Set())
  }

  function selectSingleGroup(id: number): void {
    setSelectedId(null)
    setMultiSelectedIds(new Set())
    setSelectedGroupIds(new Set([id]))
  }

  function clearSelection(): void {
    setSelectedId(null)
    setMultiSelectedIds(new Set())
    setSelectedGroupIds(new Set())
  }

  // Shared by the "Idée"/"Titre"/"Texte" add-menu entries — only the kind (and, for a title,
  // default title text) actually differ between them.
  async function handleAddSimpleNode(kind: InspirationKind, title: string): Promise<void> {
    if (activeBoardId === null) return
    const offset = (inspirationsRef.current.length * 32) % 400
    const center = viewCenterWorld()
    const input: InspirationInput = {
      boardId: activeBoardId,
      kind,
      title,
      emoji: null,
      descriptionHtml: '',
      videoUrl: null,
      videoThumbnailUrl: null,
      backgroundColor: null,
      fontColor: null,
      fontSize: null,
      linkedIdeaId: null,
      posX: center.x - 100 + offset,
      posY: center.y - 80 + offset,
      videos: [],
      objects: [],
      details: []
    }
    const created = await window.api.inspirations.create(input)
    setInspirations((prev) => [...prev, created])
    selectSingle(created.id)
    setAddMenuOpen(false)

    let currentId = created.id
    pushUndo({
      undo: async () => {
        await window.api.inspirations.remove(currentId)
        setInspirations((prev) => prev.filter((i) => i.id !== currentId))
      },
      redo: async () => {
        const recreated = await window.api.inspirations.create(input)
        currentId = recreated.id
        setInspirations((prev) => [...prev, recreated])
      }
    })
  }

  async function handleAddVideoNode(url: string): Promise<void> {
    if (activeBoardId === null) return
    setAddingVideo(true)
    setAddVideoError(null)
    const meta = await window.api.inspirations.fetchYoutubeMeta(url)
    if (!meta) {
      setAddVideoError('Lien YouTube invalide ou vidéo introuvable.')
      setAddingVideo(false)
      return
    }

    const offset = (inspirationsRef.current.length * 32) % 400
    const center = viewCenterWorld()
    const input: InspirationInput = {
      boardId: activeBoardId,
      kind: 'youtube_video',
      title: meta.title,
      emoji: null,
      descriptionHtml: '',
      videoUrl: url,
      videoThumbnailUrl: meta.thumbnailUrl,
      backgroundColor: null,
      fontColor: null,
      fontSize: null,
      linkedIdeaId: null,
      posX: center.x - 100 + offset,
      posY: center.y - 80 + offset,
      videos: [],
      objects: [],
      details: []
    }
    const created = await window.api.inspirations.create(input)
    setInspirations((prev) => [...prev, created])
    selectSingle(created.id)
    setAddingVideo(false)
    setVideoPromptOpen(false)

    let currentId = created.id
    pushUndo({
      undo: async () => {
        await window.api.inspirations.remove(currentId)
        setInspirations((prev) => prev.filter((i) => i.id !== currentId))
      },
      redo: async () => {
        const recreated = await window.api.inspirations.create(input)
        currentId = recreated.id
        setInspirations((prev) => [...prev, recreated])
      }
    })
  }

  async function handleAddGroup(): Promise<void> {
    if (activeBoardId === null) return
    const center = viewCenterWorld()
    const input: InspirationGroupInput = {
      boardId: activeBoardId,
      title: '',
      color: TAG_COLOR_PRESETS[0],
      posX: center.x - 180,
      posY: center.y - 130,
      width: 360,
      height: 260
    }
    const created = await window.api.inspirations.createGroup(input)
    setGroups((prev) => [...prev, created])
    setAddMenuOpen(false)

    let currentId = created.id
    pushUndo({
      undo: async () => {
        await window.api.inspirations.removeGroup(currentId)
        setGroups((prev) => prev.filter((g) => g.id !== currentId))
      },
      redo: async () => {
        const recreated = await window.api.inspirations.createGroup(input)
        currentId = recreated.id
        setGroups((prev) => [...prev, recreated])
      }
    })
  }

  async function commitMoves(
    moves: { id: number; from: { x: number; y: number }; to: { x: number; y: number } }[]
  ): Promise<void> {
    if (moves.length === 0) return
    await Promise.all(
      moves.map((m) => window.api.inspirations.updatePosition(m.id, m.to.x, m.to.y))
    )
    setInspirations((prev) =>
      prev.map((i) => {
        const move = moves.find((m) => m.id === i.id)
        return move ? { ...i, posX: move.to.x, posY: move.to.y } : i
      })
    )
    setLivePositions((prev) => {
      const next = { ...prev }
      for (const m of moves) delete next[m.id]
      return next
    })
    pushUndo({
      undo: async () => {
        await Promise.all(
          moves.map((m) => window.api.inspirations.updatePosition(m.id, m.from.x, m.from.y))
        )
        setInspirations((prev) =>
          prev.map((i) => {
            const move = moves.find((m) => m.id === i.id)
            return move ? { ...i, posX: move.from.x, posY: move.from.y } : i
          })
        )
      },
      redo: async () => {
        await Promise.all(
          moves.map((m) => window.api.inspirations.updatePosition(m.id, m.to.x, m.to.y))
        )
        setInspirations((prev) =>
          prev.map((i) => {
            const move = moves.find((m) => m.id === i.id)
            return move ? { ...i, posX: move.to.x, posY: move.to.y } : i
          })
        )
      }
    })
  }

  type PosMove = { id: number; from: { x: number; y: number }; to: { x: number; y: number } }

  // Same idea as commitMoves(), but for a drag that can carry both nodes and groups at once (a
  // group-header drag pulls its contained nodes along, and dragging any item in a bigger
  // selection pulls the whole selection) — everything persists and undoes/redoes as ONE action.
  async function commitCombinedMove(nodeMoves: PosMove[], groupMoves: PosMove[]): Promise<void> {
    if (nodeMoves.length === 0 && groupMoves.length === 0) return

    async function applyNodes(moves: PosMove[], key: 'from' | 'to'): Promise<void> {
      await Promise.all(
        moves.map((m) => window.api.inspirations.updatePosition(m.id, m[key].x, m[key].y))
      )
      setInspirations((prev) =>
        prev.map((i) => {
          const move = moves.find((m) => m.id === i.id)
          return move ? { ...i, posX: move[key].x, posY: move[key].y } : i
        })
      )
    }
    async function applyGroups(moves: PosMove[], key: 'from' | 'to'): Promise<void> {
      for (const m of moves) {
        const group = groupsRef.current.find((g) => g.id === m.id)
        if (!group) continue
        // m[key] is {x, y} (PosMove's shape) — must map onto the group's posX/posY fields
        // explicitly; spreading it directly would add unused x/y keys without ever touching
        // posX/posY, silently persisting the group's OLD position on every drag.
        await window.api.inspirations.updateGroup(
          m.id,
          toGroupInput({ ...group, posX: m[key].x, posY: m[key].y })
        )
      }
      setGroups((prev) =>
        prev.map((g) => {
          const move = moves.find((m) => m.id === g.id)
          return move ? { ...g, posX: move[key].x, posY: move[key].y } : g
        })
      )
    }

    await Promise.all([applyNodes(nodeMoves, 'to'), applyGroups(groupMoves, 'to')])
    setLivePositions((prev) => {
      const next = { ...prev }
      for (const m of nodeMoves) delete next[m.id]
      return next
    })
    setGroupLivePositions((prev) => {
      const next = { ...prev }
      for (const m of groupMoves) delete next[m.id]
      return next
    })

    pushUndo({
      undo: async () => {
        await Promise.all([applyNodes(nodeMoves, 'from'), applyGroups(groupMoves, 'from')])
      },
      redo: async () => {
        await Promise.all([applyNodes(nodeMoves, 'to'), applyGroups(groupMoves, 'to')])
      }
    })
  }

  async function nudgeSelected(dx: number, dy: number): Promise<void> {
    const ids = Array.from(multiSelectedIdsRef.current)
    if (ids.length === 0) return
    const moves = ids
      .map((id) => inspirationsRef.current.find((i) => i.id === id))
      .filter((i): i is Inspiration => i !== undefined)
      .map((i) => ({
        id: i.id,
        from: { x: i.posX, y: i.posY },
        to: { x: i.posX + dx, y: i.posY + dy }
      }))
    await commitMoves(moves)
  }

  async function deleteInspirations(ids: number[]): Promise<void> {
    const idSet = new Set(ids)
    const snapshots = inspirationsRef.current.filter((i) => idSet.has(i.id))
    if (snapshots.length === 0) return
    const incidentLinks = linksRef.current.filter((l) => idSet.has(l.fromId) || idSet.has(l.toId))

    await Promise.all(snapshots.map((s) => window.api.inspirations.remove(s.id)))
    setInspirations((prev) => prev.filter((i) => !idSet.has(i.id)))
    setLinks((prev) => prev.filter((l) => !idSet.has(l.fromId) && !idSet.has(l.toId)))
    if (selectedId !== null && idSet.has(selectedId)) setSelectedId(null)
    setMultiSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })

    const idMap = new Map<number, number>(snapshots.map((s) => [s.id, s.id]))

    pushUndo({
      undo: async () => {
        for (const s of snapshots) {
          const recreated = await window.api.inspirations.create(toInspirationInput(s))
          idMap.set(s.id, recreated.id)
          setInspirations((prev) => [...prev, recreated])
        }
        for (const l of incidentLinks) {
          const from = idMap.get(l.fromId) ?? l.fromId
          const to = idMap.get(l.toId) ?? l.toId
          const otherStillExists =
            inspirationsRef.current.some((i) => i.id === l.fromId) ||
            inspirationsRef.current.some((i) => i.id === l.toId) ||
            idMap.has(l.fromId) ||
            idMap.has(l.toId)
          if (!otherStillExists) continue
          const link = await window.api.inspirations.createLink(from, to)
          if (link) setLinks((prev) => [...prev, link])
        }
      },
      redo: async () => {
        const currentIds = snapshots
          .map((s) => idMap.get(s.id))
          .filter((id): id is number => id !== undefined)
        await Promise.all(currentIds.map((id) => window.api.inspirations.remove(id)))
        const currentIdSet = new Set(currentIds)
        setInspirations((prev) => prev.filter((i) => !currentIdSet.has(i.id)))
        setLinks((prev) =>
          prev.filter((l) => !currentIdSet.has(l.fromId) && !currentIdSet.has(l.toId))
        )
      }
    })
  }

  async function cloneInspirations(ids: number[]): Promise<void> {
    const snapshots = inspirationsRef.current.filter((i) => ids.includes(i.id))
    if (snapshots.length === 0) return

    async function createClones(): Promise<Inspiration[]> {
      const created: Inspiration[] = []
      for (const s of snapshots) {
        const clone = await window.api.inspirations.create({
          ...toInspirationInput(s),
          posX: s.posX + 32,
          posY: s.posY + 32
        })
        created.push(clone)
      }
      return created
    }

    const created = await createClones()
    setInspirations((prev) => [...prev, ...created])
    let currentIds = created.map((c) => c.id)
    setMultiSelectedIds(new Set(currentIds))
    setSelectedId(currentIds.length === 1 ? currentIds[0] : null)

    pushUndo({
      undo: async () => {
        await Promise.all(currentIds.map((id) => window.api.inspirations.remove(id)))
        const idsSet = new Set(currentIds)
        setInspirations((prev) => prev.filter((i) => !idsSet.has(i.id)))
      },
      redo: async () => {
        const recreated = await createClones()
        currentIds = recreated.map((c) => c.id)
        setInspirations((prev) => [...prev, ...recreated])
      }
    })
  }

  async function handleCreateLink(fromId: number, toId: number): Promise<void> {
    const link = await window.api.inspirations.createLink(fromId, toId)
    if (!link) return
    setLinks((prev) => (prev.some((l) => l.id === link.id) ? prev : [...prev, link]))

    let currentId = link.id
    pushUndo({
      undo: async () => {
        await window.api.inspirations.removeLink(currentId)
        setLinks((prev) => prev.filter((l) => l.id !== currentId))
      },
      redo: async () => {
        const recreated = await window.api.inspirations.createLink(fromId, toId)
        if (recreated) {
          currentId = recreated.id
          setLinks((prev) => [...prev, recreated])
        }
      }
    })
  }

  async function handleRemoveLink(id: number): Promise<void> {
    const removed = linksRef.current.find((l) => l.id === id)
    setLinks((prev) => prev.filter((l) => l.id !== id))
    await window.api.inspirations.removeLink(id)
    if (!removed) return

    let currentId = id
    pushUndo({
      undo: async () => {
        const recreated = await window.api.inspirations.createLink(removed.fromId, removed.toId)
        if (recreated) {
          currentId = recreated.id
          setLinks((prev) => [...prev, recreated])
        }
      },
      redo: async () => {
        await window.api.inspirations.removeLink(currentId)
        setLinks((prev) => prev.filter((l) => l.id !== currentId))
      }
    })
  }

  // Applied on every keystroke in the panel, purely to keep the card on the canvas visually in
  // sync while editing — never touches the DB (see handleCommit for the actual save).
  function handleLiveChange(
    patch: Partial<
      Pick<
        Inspiration,
        | 'title'
        | 'emoji'
        | 'videoUrl'
        | 'videoThumbnailUrl'
        | 'backgroundColor'
        | 'fontColor'
        | 'fontSize'
        | 'linkedIdeaId'
      >
    >
  ): void {
    if (!selected) return
    const id = selected.id
    setInspirations((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  async function handleCommit(input: InspirationInput): Promise<void> {
    if (!selected) return
    const updated = await window.api.inspirations.update(selected.id, input)
    setInspirations((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  async function handleDelete(): Promise<void> {
    if (!selected) return
    await deleteInspirations([selected.id])
  }

  async function commitGroupResize(
    id: number,
    size: { width: number; height: number }
  ): Promise<void> {
    const group = groupsRef.current.find((g) => g.id === id)
    if (!group) return
    const from = { width: group.width, height: group.height }
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, width: size.width, height: size.height } : g))
    )
    setGroupLiveSizes((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await window.api.inspirations.updateGroup(id, toGroupInput({ ...group, ...size }))
    pushUndo({
      undo: async () => {
        await window.api.inspirations.updateGroup(id, toGroupInput({ ...group, ...from }))
        setGroups((prev) =>
          prev.map((g) => (g.id === id ? { ...g, width: from.width, height: from.height } : g))
        )
      },
      redo: async () => {
        await window.api.inspirations.updateGroup(id, toGroupInput({ ...group, ...size }))
        setGroups((prev) =>
          prev.map((g) => (g.id === id ? { ...g, width: size.width, height: size.height } : g))
        )
      }
    })
  }

  const groupRenameTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  function handleRenameGroup(id: number, title: string): void {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, title } : g)))
    const existing = groupRenameTimers.current.get(id)
    if (existing) clearTimeout(existing)
    groupRenameTimers.current.set(
      id,
      setTimeout(() => {
        const group = groupsRef.current.find((g) => g.id === id)
        if (group) void window.api.inspirations.updateGroup(id, toGroupInput(group))
      }, 500)
    )
  }

  async function handleRecolorGroup(id: number, color: string): Promise<void> {
    const group = groupsRef.current.find((g) => g.id === id)
    if (!group) return
    const fromColor = group.color
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, color } : g)))
    await window.api.inspirations.updateGroup(id, toGroupInput({ ...group, color }))
    pushUndo({
      undo: async () => {
        await window.api.inspirations.updateGroup(id, toGroupInput({ ...group, color: fromColor }))
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, color: fromColor } : g)))
      },
      redo: async () => {
        await window.api.inspirations.updateGroup(id, toGroupInput({ ...group, color }))
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, color } : g)))
      }
    })
  }

  async function handleDeleteGroup(id: number): Promise<void> {
    const group = groupsRef.current.find((g) => g.id === id)
    if (!group) return
    const input = toGroupInput(group)
    await window.api.inspirations.removeGroup(id)
    setGroups((prev) => prev.filter((g) => g.id !== id))

    let currentId = id
    pushUndo({
      undo: async () => {
        const recreated = await window.api.inspirations.createGroup(input)
        currentId = recreated.id
        setGroups((prev) => [...prev, recreated])
      },
      redo: async () => {
        await window.api.inspirations.removeGroup(currentId)
        setGroups((prev) => prev.filter((g) => g.id !== currentId))
      }
    })
  }

  async function handleExportBoard(): Promise<void> {
    if (activeBoardId === null) return
    const result = await window.api.inspirations.exportBoard(activeBoardId)
    if (result.success) setBoardStatusMessage(`Mind map exporté : ${result.path}`)
    else if (!result.canceled) setBoardStatusMessage(result.error ?? "Échec de l'export.")
  }

  async function handlePickImportFile(): Promise<void> {
    const path = await window.api.inspirations.pickImportBoardFile()
    if (path) setPendingImportFile(path)
  }

  async function handleConfirmImport(target: ImportBoardTarget): Promise<void> {
    if (!pendingImportFile || activeBoardId === null) return
    setImportingBoard(true)

    let targetBoardId = activeBoardId
    let targetBoardName: string | null = null
    if (target === 'new') {
      const fileLabel =
        pendingImportFile
          .split(/[/\\]/)
          .pop()
          ?.replace(/\.json$/i, '') ?? 'Import'
      const newBoard = await window.api.inspirations.createBoard(fileLabel)
      setBoards((prev) => [...prev, newBoard])
      targetBoardId = newBoard.id
      targetBoardName = newBoard.name
    }

    const mode: BackupMode = target === 'replace' ? 'replace' : 'merge'
    const result = await window.api.inspirations.importBoard(pendingImportFile, mode, targetBoardId)
    setImportingBoard(false)
    setPendingImportFile(null)

    if (result.success) {
      setBoardStatusMessage(
        `Import réussi${targetBoardName ? ` dans « ${targetBoardName} »` : ''} : ${result.addedInspirations ?? 0} carte(s), ${result.addedLinks ?? 0} lien(s), ${result.addedGroups ?? 0} groupe(s) ajouté(s).`
      )
      if (targetBoardId === activeBoardId) await refresh()
      else setActiveBoardId(targetBoardId)
    } else {
      setBoardStatusMessage(result.error ?? "Échec de l'import.")
    }
  }

  function handleNodeMouseDown(id: number, e: ReactMouseEvent): void {
    e.stopPropagation()
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setMultiSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedId(next.size === 1 ? Array.from(next)[0] : null)
        return next
      })
      return
    }

    const { nodeIds, groupIds, isActiveSelection } = computeDragSelection('node', id)
    if (!isActiveSelection) selectSingle(id)

    const nodeOrigins: Record<number, { x: number; y: number }> = {}
    for (const nid of nodeIds) nodeOrigins[nid] = positionOf(nid)
    const groupOrigins: Record<number, { x: number; y: number }> = {}
    for (const gid of groupIds) groupOrigins[gid] = groupPositionOf(gid)
    setDrag({
      type: 'move',
      nodeIds,
      groupIds,
      startClientX: e.clientX,
      startClientY: e.clientY,
      nodeOrigins,
      groupOrigins
    })
  }

  function handleLinkHandleMouseDown(id: number, e: ReactMouseEvent): void {
    e.stopPropagation()
    setDrag({ type: 'link', fromId: id })
    setLiveLinkPoint(screenToWorld(e.clientX, e.clientY))
  }

  function handleGroupHeaderMouseDown(id: number, e: ReactMouseEvent): void {
    e.stopPropagation()
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setSelectedGroupIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      setSelectedId(null)
      return
    }

    const { nodeIds, groupIds, isActiveSelection } = computeDragSelection('group', id)
    if (!isActiveSelection) selectSingleGroup(id)

    const nodeOrigins: Record<number, { x: number; y: number }> = {}
    for (const nid of nodeIds) nodeOrigins[nid] = positionOf(nid)
    const groupOrigins: Record<number, { x: number; y: number }> = {}
    for (const gid of groupIds) groupOrigins[gid] = groupPositionOf(gid)
    setDrag({
      type: 'move',
      nodeIds,
      groupIds,
      startClientX: e.clientX,
      startClientY: e.clientY,
      nodeOrigins,
      groupOrigins
    })
  }

  function handleGroupResizeMouseDown(id: number, e: ReactMouseEvent): void {
    e.stopPropagation()
    const size = groupSizeOf(id)
    setDrag({
      type: 'group-resize',
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originWidth: size.width,
      originHeight: size.height
    })
  }

  // Mousedown only ever reaches the canvas background itself — every node, group and link-handle
  // already stops propagation on its own mousedown — so this is always "grabbed empty space".
  // Plain drag pans the view; Shift+drag or Ctrl+drag instead draws a rubber-band selection
  // rectangle (both modifiers accepted — Shift is the common "add to selection" convention in
  // design tools, Ctrl is the common one in Windows file lists, so either works here).
  function handleCanvasMouseDown(e: ReactMouseEvent): void {
    if (e.button !== 0) return
    didDragRef.current = false
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const world = screenToWorld(e.clientX, e.clientY)
      setSelectionRect({ start: world, current: world })
      setDrag({ type: 'select' })
      return
    }
    setDrag({
      type: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: panRef.current.x,
      startPanY: panRef.current.y
    })
  }

  // Mouse-wheel zoom, centered on the cursor: keeps the world point currently under the cursor
  // fixed on screen as the zoom level changes, rather than zooming around the world origin.
  function handleWheel(e: ReactWheelEvent<HTMLDivElement>): void {
    e.preventDefault()
    const el = viewportRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const factor = Math.exp(-e.deltaY * 0.0015)
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor))
    if (nextZoom === zoomRef.current) return

    const worldX = (mx - panRef.current.x) / zoomRef.current
    const worldY = (my - panRef.current.y) / zoomRef.current
    setZoom(nextZoom)
    setPan({ x: mx - worldX * nextZoom, y: my - worldY * nextZoom })
  }

  // The native click that follows a mousedown+mouseup normally deselects (see the canvas div's
  // onClick below) — but not when that mousedown/mouseup pair was actually a pan or select drag.
  function handleCanvasClick(): void {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    clearSelection()
  }

  function handleFocusNode(id: number): void {
    selectSingle(id)
    setSearchQuery('')
    setSearchOpen(false)
    const el = viewportRef.current
    if (!el) return
    const center = centerOf(id)
    setAnimatingFocus(true)
    setPan({
      x: el.clientWidth / 2 - center.x * zoomRef.current,
      y: el.clientHeight / 2 - center.y * zoomRef.current
    })
    window.setTimeout(() => setAnimatingFocus(false), 300)
  }

  function handleResetZoom(): void {
    const el = viewportRef.current
    if (!el) return
    const worldCenter = screenToWorld(
      el.getBoundingClientRect().left + el.clientWidth / 2,
      el.getBoundingClientRect().top + el.clientHeight / 2
    )
    setAnimatingFocus(true)
    setZoom(1)
    setPan({ x: el.clientWidth / 2 - worldCenter.x, y: el.clientHeight / 2 - worldCenter.y })
    window.setTimeout(() => setAnimatingFocus(false), 300)
  }

  function handleFitView(): void {
    const el = viewportRef.current
    if (!el || inspirationsRef.current.length === 0) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const insp of inspirationsRef.current) {
      const size = nodeSizesRef.current.get(insp.id) ?? FALLBACK_NODE_SIZE
      minX = Math.min(minX, insp.posX)
      minY = Math.min(minY, insp.posY)
      maxX = Math.max(maxX, insp.posX + size.width)
      maxY = Math.max(maxY, insp.posY + size.height)
    }
    const padding = 80
    const contentWidth = Math.max(1, maxX - minX + padding * 2)
    const contentHeight = Math.max(1, maxY - minY + padding * 2)
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(el.clientWidth / contentWidth, el.clientHeight / contentHeight))
    )
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    setAnimatingFocus(true)
    setZoom(nextZoom)
    setPan({
      x: el.clientWidth / 2 - centerX * nextZoom,
      y: el.clientHeight / 2 - centerY * nextZoom
    })
    window.setTimeout(() => setAnimatingFocus(false), 300)
  }

  const matchingInspirations = searchQuery.trim()
    ? inspirations
        .filter((i) => i.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        .slice(0, 8)
    : []

  // Copies the current selection (cards + groups, plus whatever cards sit inside a selected
  // group, plus any link where BOTH ends are copied) to the system clipboard as tagged JSON — the
  // payload carries full content, not ids, so it pastes cleanly into a different board or even a
  // different mind map file entirely, not just back into this one.
  async function copySelectionToClipboard(): Promise<void> {
    const nodeIds = new Set(multiSelectedIdsRef.current)
    const groupIds = Array.from(selectedGroupIdsRef.current)
    for (const gid of groupIds) {
      const group = groupsRef.current.find((g) => g.id === gid)
      if (group) for (const nid of nodesInsideGroup(group)) nodeIds.add(nid)
    }
    if (nodeIds.size === 0 && groupIds.length === 0) return

    const payload: InspirationClipboardPayload = {
      marker: CLIPBOARD_MARKER,
      inspirations: inspirationsRef.current.filter((i) => nodeIds.has(i.id)),
      groups: groupsRef.current.filter((g) => groupIds.includes(g.id)),
      links: linksRef.current.filter((l) => nodeIds.has(l.fromId) && nodeIds.has(l.toId))
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload))
    } catch {
      // Clipboard access denied/unavailable — nothing more useful to do than skip silently.
    }
  }

  async function pasteFromClipboard(): Promise<void> {
    const boardId = activeBoardIdRef.current
    if (boardId === null) return

    let raw: string
    try {
      raw = await navigator.clipboard.readText()
    } catch {
      return
    }
    let payload: InspirationClipboardPayload
    try {
      const parsed = JSON.parse(raw) as Partial<InspirationClipboardPayload>
      if (parsed.marker !== CLIPBOARD_MARKER || !parsed.inspirations || !parsed.groups) return
      payload = parsed as InspirationClipboardPayload
    } catch {
      return
    }
    if (payload.inspirations.length === 0 && payload.groups.length === 0) return

    const allX = [...payload.inspirations.map((i) => i.posX), ...payload.groups.map((g) => g.posX)]
    const allY = [...payload.inspirations.map((i) => i.posY), ...payload.groups.map((g) => g.posY)]
    const offsetX = viewCenterWorld().x - Math.min(...allX)
    const offsetY = viewCenterWorld().y - Math.min(...allY)

    async function paste(): Promise<{
      inspirations: Inspiration[]
      groups: InspirationGroup[]
      links: InspirationLink[]
    }> {
      const idMap = new Map<number, number>()
      const createdInspirations: Inspiration[] = []
      for (const insp of payload.inspirations) {
        const created = await window.api.inspirations.create({
          ...toInspirationInput(insp, boardId as number),
          posX: insp.posX + offsetX,
          posY: insp.posY + offsetY
        })
        idMap.set(insp.id, created.id)
        createdInspirations.push(created)
      }
      const createdGroups: InspirationGroup[] = []
      for (const group of payload.groups) {
        const created = await window.api.inspirations.createGroup({
          ...toGroupInput(group, boardId as number),
          posX: group.posX + offsetX,
          posY: group.posY + offsetY
        })
        createdGroups.push(created)
      }
      const createdLinks: InspirationLink[] = []
      for (const link of payload.links) {
        const from = idMap.get(link.fromId)
        const to = idMap.get(link.toId)
        if (from === undefined || to === undefined) continue
        const created = await window.api.inspirations.createLink(from, to)
        if (created) createdLinks.push(created)
      }
      return { inspirations: createdInspirations, groups: createdGroups, links: createdLinks }
    }

    const first = await paste()
    setInspirations((prev) => [...prev, ...first.inspirations])
    setGroups((prev) => [...prev, ...first.groups])
    setLinks((prev) => [...prev, ...first.links])
    setMultiSelectedIds(new Set(first.inspirations.map((i) => i.id)))
    setSelectedGroupIds(new Set(first.groups.map((g) => g.id)))
    setSelectedId(
      first.inspirations.length === 1 && first.groups.length === 0 ? first.inspirations[0].id : null
    )

    let currentInspirationIds = first.inspirations.map((i) => i.id)
    let currentGroupIds = first.groups.map((g) => g.id)
    pushUndo({
      undo: async () => {
        await Promise.all([
          ...currentInspirationIds.map((id) => window.api.inspirations.remove(id)),
          ...currentGroupIds.map((id) => window.api.inspirations.removeGroup(id))
        ])
        const idsSet = new Set(currentInspirationIds)
        const groupIdsSet = new Set(currentGroupIds)
        setInspirations((prev) => prev.filter((i) => !idsSet.has(i.id)))
        setGroups((prev) => prev.filter((g) => !groupIdsSet.has(g.id)))
        setLinks((prev) => prev.filter((l) => !idsSet.has(l.fromId) && !idsSet.has(l.toId)))
      },
      redo: async () => {
        const again = await paste()
        currentInspirationIds = again.inspirations.map((i) => i.id)
        currentGroupIds = again.groups.map((g) => g.id)
        setInspirations((prev) => [...prev, ...again.inspirations])
        setGroups((prev) => [...prev, ...again.groups])
        setLinks((prev) => [...prev, ...again.links])
      }
    })
  }

  // Global keyboard shortcuts: undo/redo, copy/paste, delete, duplicate, deselect, nudge, reset
  // zoom. Attached once — every handler below reads exclusively from refs (never straight from
  // render-scoped state) so it stays correct no matter how long this one closure lives.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const meta = e.ctrlKey || e.metaKey
      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        void handleUndo()
        return
      }
      if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        void handleRedo()
        return
      }

      if (isEditableTarget(document.activeElement)) return

      if (meta && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        void copySelectionToClipboard()
        return
      }
      if (meta && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        void pasteFromClipboard()
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && multiSelectedIdsRef.current.size > 0) {
        e.preventDefault()
        void deleteInspirations(Array.from(multiSelectedIdsRef.current))
        return
      }
      if (meta && e.key.toLowerCase() === 'd' && multiSelectedIdsRef.current.size > 0) {
        e.preventDefault()
        void cloneInspirations(Array.from(multiSelectedIdsRef.current))
        return
      }
      if (e.key === 'Escape') {
        clearSelection()
        return
      }
      if (meta && e.key === '0') {
        e.preventDefault()
        handleResetZoom()
        return
      }

      const nudgeMap: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0]
      }
      const nudge = nudgeMap[e.key]
      if (nudge && multiSelectedIdsRef.current.size > 0) {
        e.preventDefault()
        const step = e.shiftKey ? 20 : 4
        void nudgeSelected(nudge[0] * step, nudge[1] * step)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Centralizing every drag gesture (move nodes, pan, rubber-band select, resize a group, or drag
  // out a new link) behind one pair of window-level listeners — rather than each element owning
  // its own — is what lets the SVG connection lines track a node's live position while it's
  // mid-drag, and lets a link-drag hit-test across every node from a single place.
  useEffect(() => {
    if (!drag) return

    function handleMouseMove(e: MouseEvent): void {
      if (!drag) return
      if (drag.type === 'move') {
        // Divide by zoom: a screen-pixel mouse delta corresponds to more world units when zoomed
        // out, fewer when zoomed in. No clamping to >= 0 — the canvas is infinite now. Moves
        // nodes and groups together in lockstep, using the same delta for both.
        const dx = (e.clientX - drag.startClientX) / zoomRef.current
        const dy = (e.clientY - drag.startClientY) / zoomRef.current
        if (drag.nodeIds.length > 0) {
          setLivePositions((prev) => {
            const next = { ...prev }
            for (const id of drag.nodeIds) {
              const origin = drag.nodeOrigins[id]
              next[id] = { x: snapValue(origin.x + dx), y: snapValue(origin.y + dy) }
            }
            return next
          })
        }
        if (drag.groupIds.length > 0) {
          setGroupLivePositions((prev) => {
            const next = { ...prev }
            for (const id of drag.groupIds) {
              const origin = drag.groupOrigins[id]
              next[id] = { x: snapValue(origin.x + dx), y: snapValue(origin.y + dy) }
            }
            return next
          })
        }
      } else if (drag.type === 'link') {
        setLiveLinkPoint(screenToWorld(e.clientX, e.clientY))
      } else if (drag.type === 'select') {
        didDragRef.current = true
        setSelectionRect((prev) =>
          prev ? { ...prev, current: screenToWorld(e.clientX, e.clientY) } : prev
        )
      } else if (drag.type === 'group-resize') {
        const dx = (e.clientX - drag.startClientX) / zoomRef.current
        const dy = (e.clientY - drag.startClientY) / zoomRef.current
        setGroupLiveSizes((prev) => ({
          ...prev,
          [drag.id]: {
            width: Math.max(140, snapValue(drag.originWidth + dx)),
            height: Math.max(100, snapValue(drag.originHeight + dy))
          }
        }))
      } else {
        const dx = e.clientX - drag.startClientX
        const dy = e.clientY - drag.startClientY
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true
        // translate() is applied in unscaled screen pixels regardless of the accompanying
        // scale(), so panning is a direct 1:1 screen-pixel drag independent of zoom.
        setPan({ x: drag.startPanX + dx, y: drag.startPanY + dy })
      }
    }

    function handleMouseUp(e: MouseEvent): void {
      if (!drag) return
      if (drag.type === 'move') {
        const nodeMoves = drag.nodeIds
          .map((id) => ({ id, from: drag.nodeOrigins[id], to: livePositionsRef.current[id] }))
          .filter((m): m is PosMove => Boolean(m.to))
        const groupMoves = drag.groupIds
          .map((id) => ({ id, from: drag.groupOrigins[id], to: groupLivePositionsRef.current[id] }))
          .filter((m): m is PosMove => Boolean(m.to))
        void commitCombinedMove(nodeMoves, groupMoves)
      } else if (drag.type === 'link') {
        const targetEl = (
          document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        )?.closest('[data-inspiration-id]')
        const targetId = targetEl ? Number(targetEl.getAttribute('data-inspiration-id')) : null
        if (targetId && targetId !== drag.fromId) {
          void handleCreateLink(drag.fromId, targetId)
        }
      } else if (drag.type === 'select') {
        setSelectionRect((prevRect) => {
          if (prevRect) {
            const minX = Math.min(prevRect.start.x, prevRect.current.x)
            const maxX = Math.max(prevRect.start.x, prevRect.current.x)
            const minY = Math.min(prevRect.start.y, prevRect.current.y)
            const maxY = Math.max(prevRect.start.y, prevRect.current.y)
            const nodeHits = inspirationsRef.current.filter((insp) => {
              const pos = livePositionsRef.current[insp.id] ?? { x: insp.posX, y: insp.posY }
              const size = nodeSizesRef.current.get(insp.id) ?? FALLBACK_NODE_SIZE
              return (
                pos.x < maxX &&
                pos.x + size.width > minX &&
                pos.y < maxY &&
                pos.y + size.height > minY
              )
            })
            // A group counts as "hit" by its header bar, not its full body — rubber-banding just
            // the cards inside a frame (without also grabbing the frame itself) should only
            // select those cards, not the group around them.
            const groupHits = groupsRef.current.filter((g) => {
              const pos = groupLivePositionsRef.current[g.id] ?? { x: g.posX, y: g.posY }
              const size = groupLiveSizesRef.current[g.id] ?? { width: g.width, height: g.height }
              return pos.x < maxX && pos.x + size.width > minX && pos.y - 40 < maxY && pos.y > minY
            })
            setMultiSelectedIds(new Set(nodeHits.map((h) => h.id)))
            setSelectedGroupIds(new Set(groupHits.map((g) => g.id)))
            setSelectedId(nodeHits.length === 1 && groupHits.length === 0 ? nodeHits[0].id : null)
          }
          return null
        })
      } else if (drag.type === 'group-resize') {
        const size = groupLiveSizesRef.current[drag.id]
        if (size) void commitGroupResize(drag.id, size)
      }
      setDrag(null)
      setLiveLinkPoint(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag])

  if (!boardsLoaded || activeBoardId === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-500">Chargement...</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`flex h-full ${resizingPanel ? 'select-none' : ''}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 px-6 pt-3">
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              onClick={() => setActiveBoardId(board.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm ${
                board.id === activeBoardId
                  ? 'border-b-2 border-blue-500 bg-white/5 text-gray-100'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {board.id === activeBoardId ? (
                <input
                  value={board.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleRenameBoard(board.id, e.target.value)}
                  className="w-28 min-w-0 bg-transparent font-medium text-gray-100 outline-none"
                />
              ) : (
                <span className="max-w-[9rem] truncate">{board.name}</span>
              )}
              {board.id === activeBoardId && boards.length > 1 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleDeleteBoard(board.id)
                  }}
                  title="Supprimer ce mind map"
                  className="text-gray-500 hover:text-red-300"
                >
                  ✕
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAddBoard}
            title="Nouveau mind map"
            className="shrink-0 rounded-t-md px-2.5 py-1.5 text-sm text-gray-500 hover:text-gray-200"
          >
            +
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-100">Inspirations</h1>
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matchingInspirations[0]) {
                    handleFocusNode(matchingInspirations[0].id)
                  }
                  if (e.key === 'Escape') {
                    setSearchQuery('')
                    setSearchOpen(false)
                  }
                }}
                placeholder="🔍 Rechercher une carte..."
                className="w-56 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
              />
              {searchOpen && matchingInspirations.length > 0 && (
                <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-md border border-white/10 bg-[#1c1d22] shadow-xl">
                  {matchingInspirations.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => handleFocusNode(i.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                    >
                      <span className="shrink-0">
                        {i.emoji || (i.kind === 'youtube_video' ? '🎥' : '💡')}
                      </span>
                      <span className="truncate">{i.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span
              title="Maj (ou Ctrl) + clic sur une carte : l'ajouter à la sélection. Maj (ou Ctrl) + glisser sur du vide : sélectionner tout ce qui est dans le cadre. Suppr : supprimer, Ctrl+D : dupliquer, Ctrl+Z / Ctrl+Maj+Z : annuler / rétablir."
              className="hidden shrink-0 cursor-help items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[11px] text-gray-500 hover:border-white/20 hover:text-gray-400 lg:flex"
            >
              ⓘ Maj/Ctrl + clic ou glisser : sélection multiple
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSnapToGrid((v) => !v)}
              title="Grille magnétique"
              className={`rounded-md border px-3 py-1.5 text-sm ${
                snapToGrid
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                  : 'border-white/10 text-gray-300 hover:bg-white/5'
              }`}
            >
              🧲 Grille
            </button>
            <button
              type="button"
              onClick={handleFitView}
              title="Ajuster la vue à toutes les cartes"
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
            >
              Ajuster
            </button>
            <button
              type="button"
              onClick={handleExportBoard}
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
            >
              Exporter
            </button>
            <button
              type="button"
              onClick={handlePickImportFile}
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
            >
              Importer
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddMenuOpen((v) => !v)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                + Nouveau
              </button>
              {addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-md border border-white/10 bg-[#1c1d22] shadow-xl">
                    <button
                      type="button"
                      onClick={() => handleAddSimpleNode('idea', 'Nouvelle idée')}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                    >
                      💡 Idée
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddMenuOpen(false)
                        setAddVideoError(null)
                        setVideoPromptOpen(true)
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                    >
                      🎥 Vidéo YouTube
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSimpleNode('title', 'Titre')}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                    >
                      🔤 Titre
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSimpleNode('text', 'Texte')}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                    >
                      📝 Texte
                    </button>
                    <button
                      type="button"
                      onClick={handleAddGroup}
                      className="block w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10"
                    >
                      🖼️ Cadre de groupe
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {boardStatusMessage && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-6 py-2 text-xs text-gray-300">
            <span>{boardStatusMessage}</span>
            <button
              type="button"
              onClick={() => setBoardStatusMessage(null)}
              className="text-gray-500 hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        )}

        <div
          ref={viewportRef}
          onMouseDown={handleCanvasMouseDown}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          className={`relative min-h-0 flex-1 overflow-hidden ${
            drag?.type === 'pan'
              ? 'cursor-grabbing'
              : drag?.type === 'select'
                ? 'cursor-crosshair'
                : 'cursor-grab'
          }`}
        >
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Chargement...</p>
          ) : inspirations.length === 0 && groups.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">
              Aucune inspiration pour l’instant. Clique sur « + Nouveau » pour commencer.
            </p>
          ) : (
            <div
              className={`absolute left-0 top-0 ${animatingFocus ? 'transition-transform duration-300' : ''}`}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0'
              }}
            >
              {snapToGrid && (
                <svg
                  className="pointer-events-none absolute"
                  style={{ left: -20000, top: -20000, width: 40000, height: 40000 }}
                >
                  <defs>
                    <pattern
                      id="mindmap-grid"
                      width={GRID_SIZE}
                      height={GRID_SIZE}
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx={1} cy={1} r={1} fill="rgba(255,255,255,0.12)" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#mindmap-grid)" />
                </svg>
              )}

              {groups.map((group) => {
                const pos = groupPositionOf(group.id)
                const size = groupSizeOf(group.id)
                return (
                  <InspirationGroupFrame
                    key={group.id}
                    group={group}
                    x={pos.x}
                    y={pos.y}
                    width={size.width}
                    height={size.height}
                    selected={selectedGroupIds.has(group.id)}
                    onHeaderMouseDown={(e) => handleGroupHeaderMouseDown(group.id, e)}
                    onResizeMouseDown={(e) => handleGroupResizeMouseDown(group.id, e)}
                    onRename={(title) => handleRenameGroup(group.id, title)}
                    onRecolor={(color) => void handleRecolorGroup(group.id, color)}
                    onDelete={() => void handleDeleteGroup(group.id)}
                  />
                )
              })}

              <svg className="pointer-events-none absolute left-0 top-0 overflow-visible">
                <g className="pointer-events-auto">
                  {links.map((link) => {
                    if (
                      !inspirations.some((i) => i.id === link.fromId) ||
                      !inspirations.some((i) => i.id === link.toId)
                    ) {
                      return null
                    }
                    const from = centerOf(link.fromId)
                    const to = centerOf(link.toId)
                    return (
                      <g key={link.id} className="group cursor-pointer">
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke="transparent"
                          strokeWidth={14}
                          onClick={() => handleRemoveLink(link.id)}
                        />
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          className="stroke-blue-500/40 group-hover:stroke-red-400/70"
                          strokeWidth={2}
                        />
                      </g>
                    )
                  })}
                </g>
                {drag?.type === 'link' &&
                  liveLinkPoint &&
                  (() => {
                    const from = centerOf(drag.fromId)
                    return (
                      <line
                        x1={from.x}
                        y1={from.y}
                        x2={liveLinkPoint.x}
                        y2={liveLinkPoint.y}
                        className="stroke-blue-400"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                      />
                    )
                  })()}
              </svg>

              {inspirations.map((inspiration) => {
                const pos = positionOf(inspiration.id)
                return (
                  <InspirationNode
                    key={inspiration.id}
                    inspiration={inspiration}
                    x={pos.x}
                    y={pos.y}
                    selected={inspiration.id === selectedId}
                    multiSelected={
                      multiSelectedIds.has(inspiration.id) && multiSelectedIds.size > 1
                    }
                    linking={drag?.type === 'link' && drag.fromId === inspiration.id}
                    linkedIdeaSummary={getLinkedIdeaSummary(inspiration.linkedIdeaId)}
                    onMouseDown={(e) => handleNodeMouseDown(inspiration.id, e)}
                    onLinkHandleMouseDown={(e) => handleLinkHandleMouseDown(inspiration.id, e)}
                    registerElement={(el) => registerNodeElement(inspiration.id, el)}
                  />
                )
              })}

              {selectionRect &&
                (() => {
                  const x = Math.min(selectionRect.start.x, selectionRect.current.x)
                  const y = Math.min(selectionRect.start.y, selectionRect.current.y)
                  const w = Math.abs(selectionRect.current.x - selectionRect.start.x)
                  const h = Math.abs(selectionRect.current.y - selectionRect.start.y)
                  return (
                    <div
                      className="pointer-events-none absolute rounded-sm border border-blue-400 bg-blue-400/10"
                      style={{ left: x, top: y, width: w, height: h }}
                    />
                  )
                })()}
            </div>
          )}

          {multiSelectedIds.size > 1 && (
            <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#1c1d22]/95 px-4 py-1.5 text-xs text-gray-200 shadow-xl">
              <span>{multiSelectedIds.size} sélectionnées</span>
              <button
                type="button"
                onClick={() => void cloneInspirations(Array.from(multiSelectedIds))}
                className="font-medium text-blue-400 hover:text-blue-300"
              >
                Dupliquer
              </button>
              <button
                type="button"
                onClick={() => void deleteInspirations(Array.from(multiSelectedIds))}
                className="font-medium text-red-400 hover:text-red-300"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="text-gray-400 hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResetZoom}
              title="Réinitialiser le zoom (Ctrl+0)"
              className="pointer-events-auto rounded-md border border-white/10 bg-[#15161a]/90 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
            >
              {Math.round(zoom * 100)}%
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <>
          <div
            onMouseDown={handlePanelResizeMouseDown}
            title="Glisser pour redimensionner"
            className="w-1 shrink-0 cursor-col-resize bg-white/5 hover:bg-blue-500/40 active:bg-blue-500/60"
          />
          <InspirationPanel
            key={selected.id}
            inspiration={selected}
            width={resizingWidth ?? panelWidth}
            ideas={ideas}
            linkedIdeaSummary={getLinkedIdeaSummary(selected.linkedIdeaId)}
            onLiveChange={handleLiveChange}
            onCommit={handleCommit}
            onDelete={handleDelete}
            onClose={clearSelection}
            onNavigateToIdea={onNavigateToIdea}
          />
        </>
      )}

      {videoPromptOpen && (
        <AddVideoNodeModal
          onCancel={() => setVideoPromptOpen(false)}
          onSubmit={handleAddVideoNode}
          submitting={addingVideo}
          error={addVideoError}
        />
      )}

      {pendingImportFile && (
        <ImportBoardModal
          fileName={pendingImportFile.split(/[/\\]/).pop() ?? pendingImportFile}
          currentBoardName={boards.find((b) => b.id === activeBoardId)?.name ?? 'ce mind map'}
          onCancel={() => setPendingImportFile(null)}
          onConfirm={handleConfirmImport}
          importing={importingBoard}
        />
      )}
    </div>
  )
}
