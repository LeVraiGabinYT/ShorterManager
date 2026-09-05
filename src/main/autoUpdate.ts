import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'

let currentStatus: UpdateStatus = { state: 'idle' }

function setStatus(status: UpdateStatus): void {
  currentStatus = status
}

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('checking-for-update', () => setStatus({ state: 'checking' }))
autoUpdater.on('update-available', (info) =>
  setStatus({ state: 'available', version: info.version })
)
autoUpdater.on('update-not-available', () => setStatus({ state: 'not-available' }))
autoUpdater.on('download-progress', (progress) =>
  setStatus({ state: 'downloading', percent: Math.round(progress.percent) })
)
autoUpdater.on('update-downloaded', (info) =>
  setStatus({ state: 'downloaded', version: info.version })
)
autoUpdater.on('error', (error) => setStatus({ state: 'error', message: error.message }))

/** Kicks off a background check shortly after launch — never blocks showing the window. */
export function checkForUpdatesOnStartup(): void {
  if (!app.isPackaged) return
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Already surfaced via the 'error' event above; avoid an unhandled rejection.
    })
  }, 3000)
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus
}

export async function checkForUpdatesNow(): Promise<void> {
  if (!app.isPackaged) {
    setStatus({ state: 'error', message: 'Vérification indisponible en mode développement.' })
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    setStatus({ state: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

export async function downloadUpdateNow(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    setStatus({ state: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

export function installUpdateNow(): void {
  autoUpdater.quitAndInstall()
}
