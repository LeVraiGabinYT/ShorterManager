import { ipcMain } from 'electron'
import { createIdea, listIdeas, removeIdea, updateIdea } from './db/ideas'
import { createObject, listObjects, removeObject, updateObject } from './db/objects'
import { createTag, listTags, removeTag, updateTag } from './db/tags'
import type { OwnedObjectInput, TagInput, VideoIdeaInput } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('ideas:list', () => listIdeas())
  ipcMain.handle('ideas:create', (_event, input: VideoIdeaInput) => createIdea(input))
  ipcMain.handle('ideas:update', (_event, id: number, input: VideoIdeaInput) =>
    updateIdea(id, input)
  )
  ipcMain.handle('ideas:remove', (_event, id: number) => removeIdea(id))

  ipcMain.handle('objects:list', () => listObjects())
  ipcMain.handle('objects:create', (_event, input: OwnedObjectInput) => createObject(input))
  ipcMain.handle('objects:update', (_event, id: number, input: OwnedObjectInput) =>
    updateObject(id, input)
  )
  ipcMain.handle('objects:remove', (_event, id: number) => removeObject(id))

  ipcMain.handle('tags:list', () => listTags())
  ipcMain.handle('tags:create', (_event, input: TagInput) => createTag(input))
  ipcMain.handle('tags:update', (_event, id: number, input: TagInput) => updateTag(id, input))
  ipcMain.handle('tags:remove', (_event, id: number) => removeTag(id))
}
