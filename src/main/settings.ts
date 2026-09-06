import { app, dialog } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type {
  AppSettings,
  OverviewSectionId,
  SettingsExportResult,
  SettingsImportResult
} from '../shared/types'
import { DEFAULT_OVERVIEW_SECTIONS, DEFAULT_STATUS_COLORS } from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  maxRecentVideos: 25,
  ruleAutoStatusOnLink: true,
  ruleMissingObjectsPreparation: true,
  statusColors: DEFAULT_STATUS_COLORS,
  showTagsOnIdeaCard: false,
  overviewSectionOrder: DEFAULT_OVERVIEW_SECTIONS,
  overviewVisibleSections: DEFAULT_OVERVIEW_SECTIONS
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function isOverviewSectionId(value: unknown): value is OverviewSectionId {
  return typeof value === 'string' && (DEFAULT_OVERVIEW_SECTIONS as string[]).includes(value)
}

// Keeps a persisted order list valid even if a future app version renames or adds a section:
// unknown ids are dropped, and a section missing from an already-saved order (because it didn't
// exist yet when the user last customized their layout) is inserted at the same relative spot it
// holds in DEFAULT_OVERVIEW_SECTIONS — not blindly appended at the very end. This matters because
// "tasks" defaults to the FIRST section: a user who customized their order before the Tâches
// feature existed must still get it inserted at the front, not tacked on after everything else.
function sanitizeOverviewOrder(value: unknown): OverviewSectionId[] {
  const filtered = Array.isArray(value) ? value.filter(isOverviewSectionId) : []
  if (filtered.length === 0) return [...DEFAULT_OVERVIEW_SECTIONS]

  const result = [...filtered]
  const defaultIndex = new Map(DEFAULT_OVERVIEW_SECTIONS.map((id, i) => [id, i]))
  for (const id of DEFAULT_OVERVIEW_SECTIONS) {
    if (result.includes(id)) continue
    const idx = defaultIndex.get(id) as number
    let insertAt = result.length
    for (let i = 0; i < result.length; i++) {
      if ((defaultIndex.get(result[i]) as number) > idx) {
        insertAt = i
        break
      }
    }
    result.splice(insertAt, 0, id)
  }
  return result
}

// A section missing from an already-saved visibility list (because it didn't exist yet) defaults
// to visible, same as every section did when visibility was first introduced — not hidden.
function sanitizeOverviewVisibility(value: unknown): OverviewSectionId[] {
  const filtered = Array.isArray(value) ? value.filter(isOverviewSectionId) : []
  if (!Array.isArray(value)) return [...DEFAULT_OVERVIEW_SECTIONS]
  const missing = DEFAULT_OVERVIEW_SECTIONS.filter((id) => !filtered.includes(id))
  return [...filtered, ...missing]
}

function mergeWithDefaults(parsed: Partial<AppSettings>): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    statusColors: { ...DEFAULT_STATUS_COLORS, ...parsed.statusColors },
    overviewSectionOrder: sanitizeOverviewOrder(parsed.overviewSectionOrder),
    overviewVisibleSections: sanitizeOverviewVisibility(parsed.overviewVisibleSections)
  }
}

export function loadSettings(): AppSettings {
  const settingsPath = getSettingsPath()
  if (!existsSync(settingsPath)) return DEFAULT_SETTINGS
  try {
    const raw = readFileSync(settingsPath, 'utf-8')
    return mergeWithDefaults(JSON.parse(raw))
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const merged = { ...loadSettings(), ...patch }
  writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}

function timestampedSettingsFileName(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  return `ShorterManager-parametres-${stamp}.json`
}

/**
 * Settings export/import is deliberately independent from the data backup (backup.ts) — a
 * separate file, a separate dialog, no shared code path — so restoring one never touches the
 * other.
 */
export async function exportSettings(): Promise<SettingsExportResult> {
  const json = JSON.stringify(loadSettings(), null, 2)

  const result = await dialog.showSaveDialog({
    title: 'Enregistrer les paramètres ShorterManager',
    defaultPath: join(app.getPath('documents'), timestampedSettingsFileName()),
    filters: [{ name: 'Paramètres ShorterManager', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { success: false, canceled: true }

  try {
    writeFileSync(result.filePath, json, 'utf-8')
    return { success: true, path: result.filePath }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Impossible d'écrire le fichier de paramètres."
    }
  }
}

export async function pickSettingsImportFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choisir un fichier de paramètres ShorterManager',
    properties: ['openFile'],
    filters: [{ name: 'Paramètres ShorterManager', extensions: ['json'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export function importSettings(filePath: string): SettingsImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return { success: false, error: 'Impossible de lire ce fichier (JSON invalide).' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { success: false, error: "Ce fichier n'est pas un fichier de paramètres valide." }
  }

  try {
    const merged = mergeWithDefaults(parsed as Partial<AppSettings>)
    writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
