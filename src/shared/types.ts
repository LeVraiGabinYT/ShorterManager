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
  thumbnailUrl: string | null
  publishedAt: string | null
  viewCount: number | null
  likeCount: number | null
  commentCount: number | null
  averageViewPercentage: number | null
  statsFetchedAt: string | null
  tagIds: number[]
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

export interface ShorterManagerApi {
  ideas: {
    list: () => Promise<VideoIdea[]>
    create: (input: VideoIdeaInput) => Promise<VideoIdea>
    update: (id: number, input: VideoIdeaInput) => Promise<VideoIdea>
    remove: (id: number) => Promise<void>
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
    linkVideoToIdea: (youtubeVideoId: string, ideaId: number) => Promise<void>
    unlinkVideo: (youtubeVideoId: string) => Promise<void>
    setVideoTags: (youtubeVideoId: string, tagIds: number[]) => Promise<void>
    searchVideos: (query: string) => Promise<{ videos: PublishedVideo[]; error?: string }>
  }
}
