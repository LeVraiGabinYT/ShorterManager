import type { ContentFormat } from '@shared/types'

const STORAGE_KEY = 'ideas.lastUsedFormat'

// Remembers the format of the last idea actually created, anywhere in the app — used to default
// the "Format de contenu" toggle on a fresh "Nouvelle idée" whenever there's no more specific
// signal (like the Idées tab's own Shorts/Longues quick-filter) to go on.
export function getLastUsedIdeaFormat(): ContentFormat {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'short' || raw === 'long' ? raw : 'short'
  } catch {
    return 'short'
  }
}

export function setLastUsedIdeaFormat(format: ContentFormat): void {
  try {
    localStorage.setItem(STORAGE_KEY, format)
  } catch {
    // localStorage unavailable/full — losing this one preference isn't critical.
  }
}
