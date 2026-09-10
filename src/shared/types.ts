// Types partagés entre le process principal (main), le preload et le renderer.

export const IDEA_STATUSES = [
  { value: 'idea', label: 'Idée' },
  { value: 'preparation', label: 'Préparation' },
  { value: 'shooting', label: 'Tournage' },
  { value: 'editing', label: 'Montage' },
  { value: 'ready', label: 'Prête' },
  { value: 'scheduled', label: 'Programmée' },
  { value: 'published', label: 'Publiée' }
] as const

export type IdeaStatus = (typeof IDEA_STATUSES)[number]['value']

// Current default look of each status badge — the customizable "statusColors" setting starts
// from these values.
export const DEFAULT_STATUS_COLORS: Record<IdeaStatus, string> = {
  idea: '#6b7280',
  preparation: '#f97316',
  shooting: '#ef4444',
  editing: '#8b5cf6',
  ready: '#3b82f6',
  scheduled: '#10b981',
  published: '#10b981'
}

export const OVERVIEW_SECTIONS = [
  { id: 'tasks', label: 'Tâches à faire' },
  { id: 'preparation', label: 'À préparer' },
  { id: 'objects', label: 'Objets à acheter' },
  { id: 'shooting', label: 'Tournages' },
  { id: 'editing', label: 'Montages' },
  { id: 'toSchedule', label: 'À programmer' },
  { id: 'scheduled', label: 'Prochaines publications' }
] as const

export type OverviewSectionId = (typeof OVERVIEW_SECTIONS)[number]['id']

export const DEFAULT_OVERVIEW_SECTIONS: OverviewSectionId[] = OVERVIEW_SECTIONS.map((s) => s.id)

// Default 2-column split of the Vue d'ensemble sections, alternating left/right — used both as
// the fresh-install default and to migrate a pre-column-split settings file (which only had one
// flat order, rendered by alternating parity) without changing anyone's existing layout.
export const DEFAULT_OVERVIEW_COLUMN_LEFT: OverviewSectionId[] = DEFAULT_OVERVIEW_SECTIONS.filter(
  (_, index) => index % 2 === 0
)
export const DEFAULT_OVERVIEW_COLUMN_RIGHT: OverviewSectionId[] = DEFAULT_OVERVIEW_SECTIONS.filter(
  (_, index) => index % 2 === 1
)

// Onglet Stats: the master list of available stat cards, each individually toggleable
// (Paramètres) — the id/label pair here is the single source of truth for both the settings
// checklist and the card registry (src/renderer/src/features/stats/statCards.ts), which supplies
// the actual value + icon per id. Order here is the display order; a disabled card is simply not
// rendered, so the grid reflows on its own — no separate position bookkeeping needed.
export const STAT_CARDS = [
  { id: 'subscribers', label: 'Abonnés' },
  { id: 'totalChannelViews', label: 'Vues totales (chaîne)' },
  { id: 'channelVideoCount', label: 'Vidéos en ligne (chaîne)' },
  { id: 'localPublishedVideos', label: 'Vidéos suivies' },
  { id: 'ideasTotal', label: 'Idées (total)' },
  { id: 'ideasInProgress', label: 'Idées en cours' },
  { id: 'ideasScheduled', label: 'Idées programmées' },
  { id: 'ideasPublished', label: 'Idées publiées' },
  { id: 'tagsCount', label: 'Tags' },
  { id: 'seriesCount', label: 'Séries' },
  { id: 'objectsCount', label: 'Objets (total)' },
  { id: 'objectsPurchased', label: 'Objets achetés' },
  { id: 'objectsMissing', label: 'Objets manquants' },
  { id: 'tasksPending', label: 'Tâches en attente' },
  { id: 'tasksOverdue', label: 'Tâches en retard' },
  { id: 'avgViewsPerVideo', label: 'Vues moyennes / vidéo' },
  { id: 'totalLikes', label: 'Likes cumulés' },
  { id: 'totalComments', label: 'Commentaires cumulés' }
] as const

export type StatCardId = (typeof STAT_CARDS)[number]['id']

export const DEFAULT_STAT_CARDS: StatCardId[] = STAT_CARDS.map((c) => c.id)

export const TAG_COLOR_PRESETS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
  '#ec4899'
] as const

export interface Tag {
  id: number
  name: string
  color: string
  createdAt: string
}

export type TagInput = Omit<Tag, 'id' | 'createdAt'>

export interface Series {
  id: number
  name: string
  emoji: string
  createdAt: string
}

export interface OwnedObject {
  id: number
  name: string
  description: string | null
  purchaseDate: string | null
  price: number | null
  link: string | null
  purchased: boolean
  createdAt: string
  updatedAt: string
}

export type OwnedObjectInput = Omit<OwnedObject, 'id' | 'createdAt' | 'updatedAt'>

export interface VideoIdea {
  id: number
  title: string
  description: string | null
  emoji: string | null
  status: IdeaStatus
  publishDate: string | null
  shootDate: string | null
  createdAt: string
  updatedAt: string
  objectIds: number[]
  tagIds: number[]
  seriesId: number | null
}

export type VideoIdeaInput = Omit<
  VideoIdea,
  'id' | 'createdAt' | 'updatedAt' | 'objectIds' | 'tagIds'
> & {
  objectIds: number[]
  tagIds: number[]
}

// Sentinel used for an idea's view/like/comment count when it isn't linked to a posted video yet.
// Never include entries with this value in averages or other tag-performance analysis.
export const NOT_POSTED_STAT = -1

export interface PublishedVideo {
  id: number
  ideaId: number | null
  youtubeVideoId: string
  videoUrl: string
  title: string | null
  description: string | null
  thumbnailUrl: string | null
  publishedAt: string | null
  viewCount: number | null
  likeCount: number | null
  commentCount: number | null
  averageViewPercentage: number | null
  statsFetchedAt: string | null
  tagIds: number[]
  // Bridged from the linked idea's emoji (null when unlinked) — see toPublishedVideo().
  emoji: string | null
}

export const TASK_STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'done', label: 'Validée' },
  { value: 'canceled', label: 'Annulée' }
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]['value']

export interface TaskType {
  id: number
  name: string
  emoji: string
  // A type's position in the production workflow — entirely user-defined via drag-and-drop
  // (Propriétés, onglet Tâches), never hardcoded by name. Lower sorts earlier; the same-day
  // task ordering and the "ordre incohérent" warning both read this value directly.
  position: number
  createdAt: string
}

export type TaskTypeInput = Omit<TaskType, 'id' | 'createdAt' | 'position'>

export interface Task {
  id: number
  title: string
  emoji: string | null
  dueDate: string | null
  dueTime: string | null
  status: TaskStatus
  createdAt: string
  updatedAt: string
  typeIds: number[]
  ideaIds: number[]
}

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'typeIds' | 'ideaIds'> & {
  typeIds: number[]
  ideaIds: number[]
}

export interface ChannelStatus {
  connected: boolean
  channelId: string | null
  channelTitle: string | null
}

// Channel-wide totals (abonnés, vues, nombre de vidéos) — separate from ChannelStatus because
// these come from a dedicated (cheap but still network) statistics.list call, cached in
// channel_connection and only refreshed on demand (onglet Stats' "Actualiser" button), never on
// every app launch like the connection status itself.
export interface ChannelStats {
  subscriberCount: number | null
  // YouTube lets a channel owner hide their subscriber count publicly — when true,
  // subscriberCount is always null, and the UI should say so rather than showing "—".
  hiddenSubscriberCount: boolean
  totalViewCount: number | null
  videoCount: number | null
  statsFetchedAt: string | null
}

export interface ChannelConnectResult {
  success: boolean
  error?: string
  status: ChannelStatus
}

export interface AppInfo {
  version: string
  userDataPath: string
  dbPath: string
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export interface ReleaseNotes {
  version: string
  notes: string | null
  url: string
  error?: string
}

export interface AppSettings {
  maxRecentVideos: number
  // "Règles" (Paramètres): default-on automations the user can turn off.
  ruleAutoStatusOnLink: boolean
  ruleMissingObjectsPreparation: boolean
  // "Personnalisation" (Paramètres).
  statusColors: Record<IdeaStatus, string>
  showTagsOnIdeaCard: boolean
  // Vue d'ensemble customization: each section belongs to exactly one of the two columns (moving
  // a section between columns is how the user controls how many sections land on each side, not
  // just their order), independent from visibility — dragging a hidden section doesn't require
  // also showing it, and hiding a section doesn't lose its column/position.
  overviewColumnLeft: OverviewSectionId[]
  overviewColumnRight: OverviewSectionId[]
  overviewVisibleSections: OverviewSectionId[]
  // "Local" (default): data lives only in this install's SQLite database, as always. "Fichier":
  // data is instead kept in sync with a JSON file at syncFilePath — imported (merged) into the
  // local DB on launch, merged again and re-exported on quit. Meant to be pointed at a file inside
  // a locally-synced drive folder (Drive/Dropbox/OneDrive/...) so several installs share one
  // dataset — see SyncResult / performFileSync for the merge algorithm and its limits.
  storageMode: StorageMode
  syncFilePath: string | null
  // Onglet Stats: which cards are shown, independent from their (fixed) display order — see
  // STAT_CARDS above.
  statsVisibleCards: StatCardId[]
}

export type StorageMode = 'local' | 'file'

// Counts reflect changes actually applied to the LOCAL database by this sync (creates/updates/
// deletes coming FROM the file) — not what got written back out to the file, which always ends up
// mirroring the post-merge local state.
export interface SyncResult {
  success: boolean
  error?: string
  createdLocal: number
  updatedLocal: number
  deletedLocal: number
  syncedAt?: string
}

export interface SettingsExportResult {
  success: boolean
  path?: string
  error?: string
  canceled?: boolean
}

export interface SettingsImportResult {
  success: boolean
  error?: string
}

export type BackupMode = 'merge' | 'replace'

export interface BackupExportResult {
  success: boolean
  path?: string
  error?: string
  canceled?: boolean
}

export interface BackupImportResult {
  success: boolean
  error?: string
  mode?: BackupMode
  addedIdeas?: number
  skippedIdeas?: number
  addedObjects?: number
  addedTags?: number
  addedSeries?: number
  addedVideos?: number
  relinkedVideos?: number
  channelRestored?: boolean
  addedTaskTypes?: number
  addedTasks?: number
}

export interface ShorterManagerApi {
  ideas: {
    list: () => Promise<VideoIdea[]>
    create: (input: VideoIdeaInput) => Promise<VideoIdea>
    update: (id: number, input: VideoIdeaInput) => Promise<VideoIdea>
    remove: (id: number) => Promise<void>
    mergeDuplicates: () => Promise<{
      mergedGroups: number
      removedIdeas: number
      backfilledShootDates: number
    }>
  }
  objects: {
    list: () => Promise<OwnedObject[]>
    create: (input: OwnedObjectInput) => Promise<OwnedObject>
    update: (id: number, input: OwnedObjectInput) => Promise<OwnedObject>
    remove: (id: number) => Promise<void>
  }
  tags: {
    list: () => Promise<Tag[]>
    create: (input: TagInput) => Promise<Tag>
    update: (id: number, input: TagInput) => Promise<Tag>
    remove: (id: number) => Promise<void>
  }
  channel: {
    getStatus: () => Promise<ChannelStatus>
    connect: () => Promise<ChannelConnectResult>
    disconnect: () => Promise<void>
    listVideos: () => Promise<PublishedVideo[]>
    refreshVideos: () => Promise<{ videos: PublishedVideo[]; error?: string }>
    createIdeaFromVideo: (youtubeVideoId: string) => Promise<VideoIdea>
    linkVideoToIdea: (youtubeVideoId: string, ideaId: number) => Promise<VideoIdea>
    unlinkVideo: (youtubeVideoId: string) => Promise<void>
    setVideoTags: (youtubeVideoId: string, tagIds: number[]) => Promise<void>
    searchVideos: (query: string) => Promise<{ videos: PublishedVideo[]; error?: string }>
    getStats: () => Promise<ChannelStats>
    refreshStats: () => Promise<{ stats: ChannelStats; error?: string }>
  }
  series: {
    list: () => Promise<Series[]>
    create: (name: string) => Promise<Series>
    rename: (id: number, name: string) => Promise<Series>
    updateEmoji: (id: number, emoji: string) => Promise<Series>
    remove: (id: number) => Promise<void>
  }
  taskTypes: {
    list: () => Promise<TaskType[]>
    create: (input: TaskTypeInput) => Promise<TaskType>
    reorder: (orderedIds: number[]) => Promise<TaskType[]>
    remove: (id: number) => Promise<void>
  }
  tasks: {
    list: () => Promise<Task[]>
    create: (input: TaskInput) => Promise<Task>
    update: (id: number, input: TaskInput) => Promise<Task>
    setStatus: (id: number, status: TaskStatus) => Promise<Task>
    reschedule: (id: number, dueDate: string | null, dueTime: string | null) => Promise<Task>
    remove: (id: number) => Promise<void>
  }
  app: {
    getInfo: () => Promise<AppInfo>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>
    export: () => Promise<SettingsExportResult>
    pickImportFile: () => Promise<string | null>
    import: (filePath: string) => Promise<SettingsImportResult>
  }
  backup: {
    export: () => Promise<BackupExportResult>
    pickImportFile: () => Promise<string | null>
    import: (filePath: string, mode: BackupMode) => Promise<BackupImportResult>
    wipeAll: () => Promise<{ success: boolean; error?: string }>
  }
  sync: {
    pickFile: () => Promise<string | null>
    now: () => Promise<SyncResult>
    getLastResult: () => Promise<SyncResult | null>
  }
  updates: {
    check: () => Promise<void>
    download: () => Promise<void>
    installNow: () => Promise<void>
    getStatus: () => Promise<UpdateStatus>
    getReleaseNotes: () => Promise<ReleaseNotes>
  }
}
