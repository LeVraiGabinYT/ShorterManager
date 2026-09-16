import { dialog } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { getExportDir, timestampedFileName } from './backup'
import {
  addInspirationGroupsFromBackup,
  listInspirationGroups,
  replaceAllInspirationGroups
} from './db/inspirationGroups'
import {
  addInspirationsFromBackup,
  listInspirationLinks,
  listInspirations,
  replaceAllInspirations
} from './db/inspirations'
import type {
  BackupExportResult,
  BackupMode,
  Inspiration,
  InspirationGroup,
  InspirationLink,
  InspirationsImportResult
} from '../shared/types'

const MINDMAP_BACKUP_VERSION = 1

interface MindmapBackupData {
  version: number
  exportedAt: string
  inspirations: Inspiration[]
  links: InspirationLink[]
  groups: InspirationGroup[]
}

function isValidMindmapBackupData(data: unknown): data is MindmapBackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Partial<MindmapBackupData>
  return Array.isArray(d.inspirations) && Array.isArray(d.links)
}

// Dedicated export/import for a single Inspirations mind-map board — separate from the main app
// backup (src/main/backup.ts, which exports every board at once) so one board can be shared or
// archived on its own without touching the others or ideas/objects/tasks/etc.
export async function exportInspirationsBoard(boardId: number): Promise<BackupExportResult> {
  const data: MindmapBackupData = {
    version: MINDMAP_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    inspirations: listInspirations(boardId),
    links: listInspirationLinks(boardId),
    groups: listInspirationGroups(boardId)
  }
  const json = JSON.stringify(data, null, 2)

  const result = await dialog.showSaveDialog({
    title: 'Enregistrer le mind map Inspirations',
    defaultPath: join(getExportDir(), timestampedFileName('ShorterManager-mindmap')),
    filters: [{ name: 'Mind map ShorterManager', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { success: false, canceled: true }

  try {
    const dir = dirname(result.filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(result.filePath, json, 'utf-8')
    return { success: true, path: result.filePath }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Impossible d'écrire le fichier."
    }
  }
}

export async function pickInspirationsImportFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choisir un fichier mind map ShorterManager',
    defaultPath: getExportDir(),
    properties: ['openFile'],
    filters: [{ name: 'Mind map ShorterManager', extensions: ['json'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export function importInspirationsBoard(
  filePath: string,
  mode: BackupMode,
  targetBoardId: number
): InspirationsImportResult {
  let data: unknown
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return { success: false, error: 'Impossible de lire ce fichier (JSON invalide).' }
  }

  if (!isValidMindmapBackupData(data)) {
    return { success: false, error: "Ce fichier n'est pas un mind map ShorterManager valide." }
  }

  try {
    if (mode === 'replace') {
      replaceAllInspirations(targetBoardId, data.inspirations, data.links)
      replaceAllInspirationGroups(targetBoardId, data.groups ?? [])
      return {
        success: true,
        mode: 'replace',
        addedInspirations: data.inspirations.length,
        addedLinks: data.links.length,
        addedGroups: (data.groups ?? []).length
      }
    }

    const result = addInspirationsFromBackup(targetBoardId, data.inspirations, data.links)
    const addedGroups = addInspirationGroupsFromBackup(targetBoardId, data.groups ?? [])
    return {
      success: true,
      mode: 'merge',
      addedInspirations: result.addedInspirations,
      addedLinks: result.addedLinks,
      addedGroups
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
