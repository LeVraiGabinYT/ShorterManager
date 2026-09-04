import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OwnedObject, VideoIdea } from '@shared/types'

export interface IdeasData {
  ideas: VideoIdea[]
  objects: OwnedObject[]
  objectsById: Map<number, OwnedObject>
  loading: boolean
  refresh: () => Promise<void>
}

export function useIdeasData(): IdeasData {
  const [ideas, setIdeas] = useState<VideoIdea[]>([])
  const [objects, setObjects] = useState<OwnedObject[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [ideasList, objectsList] = await Promise.all([
      window.api.ideas.list(),
      window.api.objects.list()
    ])
    setIdeas(ideasList)
    setObjects(objectsList)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const objectsById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects])

  return { ideas, objects, objectsById, loading, refresh }
}
