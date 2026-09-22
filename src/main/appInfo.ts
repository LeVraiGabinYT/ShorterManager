import { app } from 'electron'
import { join } from 'path'
import type { AppInfo } from '../shared/types'

export function getAppInfo(): AppInfo {
  return {
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
    dbPath: join(app.getPath('userData'), 'shorter-manager.db')
  }
}

export function getLaunchAtStartup(): boolean {
  return app.getLoginItemSettings().openAtLogin
}

// Backed directly by the OS's login-item registration (Windows Registry Run key under the hood),
// not by our own settings.json — there's nothing to migrate or keep in sync, the OS is the single
// source of truth. In dev (electron .), this still works but registers the dev Electron binary
// itself, which is only useful for testing the toggle — not something a packaged end-user path.
export function setLaunchAtStartup(enabled: boolean): boolean {
  app.setLoginItemSettings({ openAtLogin: enabled })
  return app.getLoginItemSettings().openAtLogin
}
