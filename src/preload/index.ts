import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AppSettings,
  BackupMode,
  OwnedObjectInput,
  ShorterManagerApi,
  TagInput,
  VideoIdeaInput
} from '../shared/types'

const api: ShorterManagerApi = {
  ideas: {
    list: () => ipcRenderer.invoke('ideas:list'),
    create: (input: VideoIdeaInput) => ipcRenderer.invoke('ideas:create', input),
    update: (id: number, input: VideoIdeaInput) => ipcRenderer.invoke('ideas:update', id, input),
    remove: (id: number) => ipcRenderer.invoke('ideas:remove', id),
    mergeDuplicates: () => ipcRenderer.invoke('ideas:mergeDuplicates')
  },
  objects: {
    list: () => ipcRenderer.invoke('objects:list'),
    create: (input: OwnedObjectInput) => ipcRenderer.invoke('objects:create', input),
    update: (id: number, input: OwnedObjectInput) =>
      ipcRenderer.invoke('objects:update', id, input),
    remove: (id: number) => ipcRenderer.invoke('objects:remove', id)
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    create: (input: TagInput) => ipcRenderer.invoke('tags:create', input),
    update: (id: number, input: TagInput) => ipcRenderer.invoke('tags:update', id, input),
    remove: (id: number) => ipcRenderer.invoke('tags:remove', id)
  },
  channel: {
    getStatus: () => ipcRenderer.invoke('channel:getStatus'),
    connect: () => ipcRenderer.invoke('channel:connect'),
    disconnect: () => ipcRenderer.invoke('channel:disconnect'),
    listVideos: () => ipcRenderer.invoke('channel:listVideos'),
    refreshVideos: () => ipcRenderer.invoke('channel:refreshVideos'),
    createIdeaFromVideo: (youtubeVideoId: string) =>
      ipcRenderer.invoke('channel:createIdeaFromVideo', youtubeVideoId),
    linkVideoToIdea: (youtubeVideoId: string, ideaId: number) =>
      ipcRenderer.invoke('channel:linkVideoToIdea', youtubeVideoId, ideaId),
    unlinkVideo: (youtubeVideoId: string) =>
      ipcRenderer.invoke('channel:unlinkVideo', youtubeVideoId),
    setVideoTags: (youtubeVideoId: string, tagIds: number[]) =>
      ipcRenderer.invoke('channel:setVideoTags', youtubeVideoId, tagIds),
    searchVideos: (query: string) => ipcRenderer.invoke('channel:searchVideos', query)
  },
  series: {
    list: () => ipcRenderer.invoke('series:list'),
    create: (name: string) => ipcRenderer.invoke('series:create', name),
    rename: (id: number, name: string) => ipcRenderer.invoke('series:rename', id, name),
    remove: (id: number) => ipcRenderer.invoke('series:remove', id)
  },
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', patch)
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    pickImportFile: () => ipcRenderer.invoke('backup:pickImportFile'),
    import: (filePath: string, mode: BackupMode) =>
      ipcRenderer.invoke('backup:import', filePath, mode)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
