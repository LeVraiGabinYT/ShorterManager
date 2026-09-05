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
