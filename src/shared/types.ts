// Types partagés entre le process principal (main), le preload et le renderer.

export const IDEA_STATUSES = [
  { value: 'idea', label: 'Idée' },
  { value: 'shooting', label: 'Tournage' },
  { value: 'editing', label: 'Montage' },
  { value: 'ready', label: 'Prête' },
  { value: 'scheduled', label: 'Programmée' },
  { value: 'published', label: 'Publiée' }
] as const

export type IdeaStatus = (typeof IDEA_STATUSES)[number]['value']

export interface OwnedObject {
  id: number
  name: string
  description: string | null
  purchaseDate: string | null
  price: number | null
  link: string | null
  createdAt: string
  updatedAt: string
}

export type OwnedObjectInput = Omit<OwnedObject, 'id' | 'createdAt' | 'updatedAt'>

export interface VideoIdea {
  id: number
  title: string
  description: string | null
  status: IdeaStatus
  publishDate: string | null
  shootDate: string | null
  createdAt: string
  updatedAt: string
  objectIds: number[]
}

export type VideoIdeaInput = Omit<VideoIdea, 'id' | 'createdAt' | 'updatedAt' | 'objectIds'> & {
  objectIds: number[]
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
}
