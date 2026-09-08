import { useEffect, useState } from 'react'

// Lightweight "remember where I was" persistence for UI navigation state (which sub-tab, which
// filter view) — same localStorage-backed pattern already used for the Analyse tab's groups and
// the Idées tab's filters, just generic enough to reuse for a plain value instead of duplicating
// the load/save boilerplate at every call site. Not meant for actual app data (that belongs in the
// database) — purely "what was on screen last time".
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return defaultValue
      const parsed = JSON.parse(raw)
      if (isValid && !isValid(parsed)) return defaultValue
      return parsed as T
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // localStorage unavailable/full — losing the "last screen" memory isn't critical.
    }
  }, [key, state])

  return [state, setState]
}
