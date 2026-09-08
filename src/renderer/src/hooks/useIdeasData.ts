import { useContext } from 'react'
import { IdeasDataContext, type IdeasData } from '../context/ideasDataContext'

export type { IdeasData }

export function useIdeasData(): IdeasData {
  const context = useContext(IdeasDataContext)
  if (!context) {
    throw new Error('useIdeasData must be used within an IdeasDataProvider')
  }
  return context
}
