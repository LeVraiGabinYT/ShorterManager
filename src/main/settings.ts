import { app, dialog } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type {
  AppSettings,
  OverviewSectionId,
  SettingsExportResult,
  SettingsImportResult,
  StorageMode
} from '../shared/types'
import {
  DEFAULT_OVERVIEW_COLUMN_LEFT,
  DEFAULT_OVERVIEW_COLUMN_RIGHT,
  DEFAULT_OVERVIEW_SECTIONS,
  DEFAULT_STATUS_COLORS
} from '../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  maxRecentVideos: 25,
  ruleAutoStatusOnLink: true,
  ruleMissingObjectsPreparation: true,
  statusColors: DEFAULT_STATUS_COLORS,
  showTagsOnIdeaCard: false,
  overviewColumnLeft: DEFAULT_OVERVIEW_COLUMN_LEFT,
  overviewColumnRight: DEFAULT_OVERVIEW_COLUMN_RIGHT,
  overviewVisibleSections: DEFAULT_OVERVIEW_SECTIONS,
  storageMode: 'local',
  syncFilePath: null
}

function sanitizeStorageMode(value: unknown): StorageMode {
  return value === 'file' ? 'file' : 'local'
}

function sanitizeSyncFilePath(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function isOverviewSectionId(value: unknown): value is OverviewSectionId {
  return typeof value === 'string' && (DEFAULT_OVERVIEW_SECTIONS as string[]).includes(value)
}

function sanitizeSectionList(value: unknown): OverviewSectionId[] {
  return Array.isArray(value) ? value.filter(isOverviewSectionId) : []
}

// Keeps the two persisted column lists valid even if a future app version renames or adds a
// section, and migrates a pre-column-split settings file (which only ever had one flat
// `overviewSectionOrder`, rendered by alternating left/right) so an already-customized layout
// survives the upgrade unchanged.
function sanitizeOverviewColumns(parsed: {
  overviewColumnLeft?: unknown
  overviewColumnRight?: unknown
  overviewSectionOrder?: unknown
}): { overviewColumnLeft: OverviewSectionId[]; overviewColumnRight: OverviewSectionId[] } {
  let left = sanitizeSectionList(parsed.overviewColumnLeft)
  let right = sanitizeSectionList(parsed.overviewColumnRight)

  if (left.length === 0 && right.length === 0) {
    const legacyOrder = sanitizeSectionList(parsed.overviewSectionOrder)
    left = legacyOrder.filter((_, i) => i % 2 === 0)
    right = legacyOrder.filter((_, i) => i % 2 === 1)
  }

  // A section hand-edited into both columns stays only in the one it was declared first for.
  right = right.filter((id) => !left.includes(id))
  left = [...new Set(left)]
  right = [...new Set(right)]

  // A section neither column knows about yet (new in this app version, or an empty legacy order)
  // goes to whichever column is currently shorter, keeping the two sides roughly balanced instead
  // of piling every new section onto one side.
  const present = new Set([...left, ...right])
  for (const id of DEFAULT_OVERVIEW_SECTIONS) {
    if (present.has(id)) continue
    if (left.length <= right.length) left.push(id)
    else right.push(id)
  }

  return { overviewColumnLeft: left, overviewColumnRight: right }
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
  const { overviewColumnLeft, overviewColumnRight } = sanitizeOverviewColumns(
    parsed as { overviewSectionOrder?: unknown } & Partial<AppSettings>
  )
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    statusColors: { ...DEFAULT_STATUS_COLORS, ...parsed.statusColors },
    overviewColumnLeft,
    overviewColumnRight,
    overviewVisibleSections: sanitizeOverviewVisibility(parsed.overviewVisibleSections),
    storageMode: sanitizeStorageMode(parsed.storageMode),
    syncFilePath: sanitizeSyncFilePath(parsed.syncFilePath)
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
