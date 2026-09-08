import { createContext } from 'react'
import type {
  AppSettings,
  OwnedObject,
  PublishedVideo,
  Series,
  Tag,
  Task,
  TaskType,
  VideoIdea
} from '@shared/types'

export interface IdeasData {
  ideas: VideoIdea[]
  ideasById: Map<number, VideoIdea>
  objects: OwnedObject[]
  objectsById: Map<number, OwnedObject>
  tags: Tag[]
  tagsById: Map<number, Tag>
  series: Series[]
  seriesById: Map<number, Series>
  publishedVideos: PublishedVideo[]
  publishedVideosByIdeaId: Map<number, PublishedVideo>
  tasks: Task[]
  taskTypes: TaskType[]
  taskTypesById: Map<number, TaskType>
  pendingTaskCountByIdeaId: Map<number, number>
  settings: AppSettings
  // Lets a settings mutation (Paramètres tab) push the already-updated AppSettings it got back
  // from the IPC call straight into the one shared copy every screen reads — without this, only
  // the Paramètres tab's own local state would see the change until the next full refresh() (e.g.
  // an app restart), so the Vue d'ensemble kept rendering the old layout after a settings edit.
  setSettings: (settings: AppSettings) => void
  loading: boolean
  refresh: () => Promise<void>
}

export const IdeasDataContext = createContext<IdeasData | null>(null)
