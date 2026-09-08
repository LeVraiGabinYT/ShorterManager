import { useCallback, useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
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
import {
  DEFAULT_OVERVIEW_COLUMN_LEFT,
  DEFAULT_OVERVIEW_COLUMN_RIGHT,
  DEFAULT_OVERVIEW_SECTIONS,
  DEFAULT_STATUS_COLORS
} from '@shared/types'
import { IdeasDataContext, type IdeasData } from './ideasDataContext'

const DEFAULT_SETTINGS: AppSettings = {
  maxRecentVideos: 25,
  ruleAutoStatusOnLink: true,
  ruleMissingObjectsPreparation: true,
  statusColors: DEFAULT_STATUS_COLORS,
  showTagsOnIdeaCard: false,
  overviewColumnLeft: DEFAULT_OVERVIEW_COLUMN_LEFT,
  overviewColumnRight: DEFAULT_OVERVIEW_COLUMN_RIGHT,
  overviewVisibleSections: DEFAULT_OVERVIEW_SECTIONS
}

// Fetched ONCE, at the app root — every tab reads the same already-loaded copy instead of each
// re-fetching (and flashing an empty "Chargement..." state) every time it mounts, which is what
// switching tabs used to do since each tab-level component called its own copy of useIdeasData.
// A mutation still just calls `refresh()`, updating the one shared copy that every mounted screen
// re-renders from.
export function IdeasDataProvider({ children }: { children: ReactNode }): ReactElement {
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

  // On startup, if a channel is connected, pull fresh video stats first — a "Programmée" idea
  // whose video picked up views since the last launch gets auto-flipped to "Publiée" as part of
  // that same refresh (see autoPublishScheduledIdeas in main/youtube/videos.ts), so this one
  // startup call is what surfaces "it went live while the app was closed" without waiting for the
  // user to open the Chaîne tab and click Actualiser themselves.
  useEffect(() => {
    async function initialize(): Promise<void> {
      const status = await window.api.channel.getStatus()
      if (status.connected) {
        await window.api.channel.refreshVideos()
      }
      await refresh()
    }
    initialize()
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

  const value: IdeasData = {
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
    setSettings,
    loading,
    refresh
  }

  return <IdeasDataContext.Provider value={value}>{children}</IdeasDataContext.Provider>
}
