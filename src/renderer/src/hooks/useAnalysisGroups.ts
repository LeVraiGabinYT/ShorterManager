import { useCallback, useEffect, useState } from 'react'
import type { AnalysisGroup } from '@shared/types'

export interface AnalysisGroupsData {
  groups: AnalysisGroup[]
  refresh: () => Promise<void>
}

export function useAnalysisGroups(): AnalysisGroupsData {
  const [groups, setGroups] = useState<AnalysisGroup[]>([])

  const refresh = useCallback(async () => {
    setGroups(await window.api.analysisGroups.list())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { groups, refresh }
}
