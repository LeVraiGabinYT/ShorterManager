import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OwnedObject, Tag, VideoIdea } from '@shared/types'

export interface IdeasData {
  ideas: VideoIdea[]
  objects: OwnedObject[]
  objectsById: Map<number, OwnedObject>
  tags: Tag[]
  tagsById: Map<number, Tag>
  loading: boolean
  refresh: () => Promise<void>
}

export function useIdeasData(): IdeasData {
  const [ideas, setIdeas] = useState<VideoIdea[]>([])
  const [objects, setObjects] = useState<OwnedObject[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [ideasList, objectsList, tagsList] = await Promise.all([
      window.api.ideas.list(),
      window.api.objects.list(),
      window.api.tags.list()
    ])
    setIdeas(ideasList)
    setObjects(objectsList)
    setTags(tagsList)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const objectsById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects])
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])

  return { ideas, objects, objectsById, tags, tagsById, loading, refresh }
}
