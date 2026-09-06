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
  { id: 'preparation', label: 'À préparer' },
  { id: 'objects', label: 'Objets à acheter' },
  { id: 'shooting', label: 'Tournages' },
  { id: 'editing', label: 'Montages' },
  { id: 'toSchedule', label: 'À programmer' },
  { id: 'scheduled', label: 'Prochaines publications' }
] as const

export type OverviewSectionId = (typeof OVERVIEW_SECTIONS)[number]['id']

export const DEFAULT_OVERVIEW_SECTIONS: OverviewSectionId[] = OVERVIEW_SECTIONS.map((s) => s.id)

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

export interface ChannelStatus {
  connected: boolean
  channelId: string | null
  channelTitle: string | null
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
  // Vue d'ensemble customization: order is independent from visibility, so dragging a hidden
  // section doesn't require also showing it, and hiding a section doesn't lose its position.
  overviewSectionOrder: OverviewSectionId[]
  overviewVisibleSections: OverviewSectionId[]
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
  }
  series: {
    list: () => Promise<Series[]>
    create: (name: string) => Promise<Series>
    rename: (id: number, name: string) => Promise<Series>
    updateEmoji: (id: number, emoji: string) => Promise<Series>
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
  updates: {
    check: () => Promise<void>
    download: () => Promise<void>
    installNow: () => Promise<void>
    getStatus: () => Promise<UpdateStatus>
    getReleaseNotes: () => Promise<ReleaseNotes>
  }
}
