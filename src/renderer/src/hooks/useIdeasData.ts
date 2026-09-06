import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { DEFAULT_OVERVIEW_SECTIONS, DEFAULT_STATUS_COLORS } from '@shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  maxRecentVideos: 25,
  ruleAutoStatusOnLink: true,
  ruleMissingObjectsPreparation: true,
  statusColors: DEFAULT_STATUS_COLORS,
  showTagsOnIdeaCard: false,
  overviewSectionOrder: DEFAULT_OVERVIEW_SECTIONS,
  overviewVisibleSections: DEFAULT_OVERVIEW_SECTIONS
}

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
  loading: boolean
  refresh: () => Promise<void>
}

export function useIdeasData(): IdeasData {
  const [ideas, setIdeas] = useState<VideoIdea[]>([])
  const [objects, setObjects] = useState<OwnedObject[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [publishedVideos, setPublishedVideos] = useState<PublishedVideo[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [
      ideasList,
      objectsList,
      tagsList,
      seriesList,
      publishedVideosList,
      tasksList,
      taskTypesList,
      settingsValue
    ] = await Promise.all([
      window.api.ideas.list(),
      window.api.objects.list(),
      window.api.tags.list(),
      window.api.series.list(),
      window.api.channel.listVideos(),
      window.api.tasks.list(),
      window.api.taskTypes.list(),
      window.api.settings.get()
    ])
    setIdeas(ideasList)
    setObjects(objectsList)
    setTags(tagsList)
    setSeries(seriesList)
    setPublishedVideos(publishedVideosList)
    setTasks(tasksList)
    setTaskTypes(taskTypesList)
    setSettings(settingsValue)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const ideasById = useMemo(() => new Map(ideas.map((i) => [i.id, i])), [ideas])
  const objectsById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects])
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s])), [series])
  const taskTypesById = useMemo(() => new Map(taskTypes.map((t) => [t.id, t])), [taskTypes])
  const publishedVideosByIdeaId = useMemo(
    () =>
      new Map(publishedVideos.filter((v) => v.ideaId !== null).map((v) => [v.ideaId as number, v])),
    [publishedVideos]
  )
  const pendingTaskCountByIdeaId = useMemo(() => {
    const map = new Map<number, number>()
    for (const task of tasks) {
      if (task.status !== 'pending') continue
      for (const ideaId of task.ideaIds) map.set(ideaId, (map.get(ideaId) ?? 0) + 1)
    }
    return map
  }, [tasks])

  return {
    ideas,
    ideasById,
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
  }
}
