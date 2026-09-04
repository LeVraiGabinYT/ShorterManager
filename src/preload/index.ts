import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { OwnedObjectInput, ShorterManagerApi, TagInput, VideoIdeaInput } from '../shared/types'

const api: ShorterManagerApi = {
  ideas: {
    list: () => ipcRenderer.invoke('ideas:list'),
    create: (input: VideoIdeaInput) => ipcRenderer.invoke('ideas:create', input),
    update: (id: number, input: VideoIdeaInput) => ipcRenderer.invoke('ideas:update', id, input),
    remove: (id: number) => ipcRenderer.invoke('ideas:remove', id)
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
