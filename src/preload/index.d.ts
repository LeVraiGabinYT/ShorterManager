import { ElectronAPI } from '@electron-toolkit/preload'
import type { ShorterManagerApi } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: ShorterManagerApi
  }
}
