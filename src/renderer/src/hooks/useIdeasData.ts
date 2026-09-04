import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OwnedObject, PublishedVideo, Tag, VideoIdea } from '@shared/types'

export interface IdeasData {
  ideas: VideoIdea[]
  objects: OwnedObject[]
  objectsById: Map<number, OwnedObject>
  tags: Tag[]
  tagsById: Map<number, Tag>
  publishedVideos: PublishedVideo[]
  publishedVideosByIdeaId: Map<number, PublishedVideo>
  loading: boolean
  refresh: () => Promise<void>
}

export function useIdeasData(): IdeasData {
  const [ideas, setIdeas] = useState<VideoIdea[]>([])
  const [objects, setObjects] = useState<OwnedObject[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [publishedVideos, setPublishedVideos] = useState<PublishedVideo[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [ideasList, objectsList, tagsList, publishedVideosList] = await Promise.all([
      window.api.ideas.list(),
      window.api.objects.list(),
      window.api.tags.list(),
      window.api.channel.listVideos()
    ])
    setIdeas(ideasList)
    setObjects(objectsList)
    setTags(tagsList)
    setPublishedVideos(publishedVideosList)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const objectsById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects])
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const publishedVideosByIdeaId = useMemo(
    () =>
      new Map(publishedVideos.filter((v) => v.ideaId !== null).map((v) => [v.ideaId as number, v])),
    [publishedVideos]
  )

  return {
    ideas,
    objects,
    objectsById,
    tags,
    tagsById,
    publishedVideos,
    publishedVideosByIdeaId,
    loading,
    refresh
  }
}
