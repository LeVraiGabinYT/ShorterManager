import { ipcMain } from 'electron'
import { getAppInfo } from './appInfo'
import {
  checkForUpdatesNow,
  downloadUpdateNow,
  getUpdateStatus,
  installUpdateNow
} from './autoUpdate'
import { exportBackup, importBackup, pickImportFile, wipeAllAppData } from './backup'
import { getReleaseNotes } from './releaseNotes'
import { getChannelStatus } from './db/channel'
import { createIdea, listIdeas, removeIdea, updateIdea } from './db/ideas'
import { createObject, listObjects, removeObject, updateObject } from './db/objects'
import { listPublishedVideos } from './db/publishedVideos'
import {
  createSeries,
  listSeries,
  removeSeries,
  renameSeries,
  updateSeriesEmoji
} from './db/series'
import { createTag, listTags, removeTag, updateTag } from './db/tags'
import {
  createTask,
  listTasks,
  removeTask,
  removeTasks,
  rescheduleTask,
  setTaskStatus,
  updateTask
} from './db/tasks'
import { createTaskType, listTaskTypes, removeTaskType, reorderTaskTypes } from './db/taskTypes'
import { mergeDuplicateIdeas } from './dedupe'
import {
  exportSettings,
  importSettings,
  loadSettings,
  pickSettingsImportFile,
  updateSettings
} from './settings'
import { connectChannel, disconnectChannel } from './youtube/oauth'
import {
  createIdeaFromVideo,
  linkVideoToIdea,
  refreshRecentVideos,
  searchChannelVideos,
  setVideoTags,
  unlinkVideo
} from './youtube/videos'
import type {
  AppSettings,
  BackupMode,
  OwnedObjectInput,
  TagInput,
  TaskInput,
  TaskStatus,
  TaskTypeInput,
  VideoIdeaInput
} from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('ideas:list', () => listIdeas())
  ipcMain.handle('ideas:create', (_event, input: VideoIdeaInput) => createIdea(input))
  ipcMain.handle('ideas:update', (_event, id: number, input: VideoIdeaInput) =>
    updateIdea(id, input)
  )
  ipcMain.handle('ideas:remove', (_event, id: number) => removeIdea(id))
  ipcMain.handle('ideas:mergeDuplicates', () => mergeDuplicateIdeas())

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

  ipcMain.handle('channel:getStatus', () => getChannelStatus())
  ipcMain.handle('channel:connect', () => connectChannel())
  ipcMain.handle('channel:disconnect', () => disconnectChannel())
  ipcMain.handle('channel:listVideos', () => listPublishedVideos())
  ipcMain.handle('channel:refreshVideos', async () => {
    try {
      return { videos: await refreshRecentVideos() }
    } catch (error) {
      return {
        videos: listPublishedVideos(),
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })
  ipcMain.handle('channel:createIdeaFromVideo', (_event, youtubeVideoId: string) =>
    createIdeaFromVideo(youtubeVideoId)
  )
  ipcMain.handle('channel:linkVideoToIdea', (_event, youtubeVideoId: string, ideaId: number) =>
    linkVideoToIdea(youtubeVideoId, ideaId)
  )
  ipcMain.handle('channel:unlinkVideo', (_event, youtubeVideoId: string) =>
    unlinkVideo(youtubeVideoId)
  )
  ipcMain.handle('channel:setVideoTags', (_event, youtubeVideoId: string, tagIds: number[]) =>
    setVideoTags(youtubeVideoId, tagIds)
  )
  ipcMain.handle('channel:searchVideos', async (_event, query: string) => {
    try {
      return { videos: await searchChannelVideos(query) }
    } catch (error) {
      return { videos: [], error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('series:list', () => listSeries())
  ipcMain.handle('series:create', (_event, name: string) => createSeries(name))
  ipcMain.handle('series:rename', (_event, id: number, name: string) => renameSeries(id, name))
  ipcMain.handle('series:updateEmoji', (_event, id: number, emoji: string) =>
    updateSeriesEmoji(id, emoji)
  )
  ipcMain.handle('series:remove', (_event, id: number) => removeSeries(id))

  ipcMain.handle('taskTypes:list', () => listTaskTypes())
  ipcMain.handle('taskTypes:create', (_event, input: TaskTypeInput) => createTaskType(input))
  ipcMain.handle('taskTypes:reorder', (_event, orderedIds: number[]) =>
    reorderTaskTypes(orderedIds)
  )
  ipcMain.handle('taskTypes:remove', (_event, id: number) => removeTaskType(id))

  ipcMain.handle('tasks:list', () => listTasks())
  ipcMain.handle('tasks:create', (_event, input: TaskInput) => createTask(input))
  ipcMain.handle('tasks:update', (_event, id: number, input: TaskInput) => updateTask(id, input))
  ipcMain.handle('tasks:setStatus', (_event, id: number, status: TaskStatus) =>
    setTaskStatus(id, status)
  )
  ipcMain.handle(
    'tasks:reschedule',
    (_event, id: number, dueDate: string | null, dueTime: string | null) =>
      rescheduleTask(id, dueDate, dueTime)
  )
  ipcMain.handle('tasks:remove', (_event, id: number) => removeTask(id))
  ipcMain.handle('tasks:removeMany', (_event, ids: number[]) => removeTasks(ids))

  ipcMain.handle('app:getInfo', () => getAppInfo())

  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:update', (_event, patch: Partial<AppSettings>) => updateSettings(patch))
  ipcMain.handle('settings:export', () => exportSettings())
  ipcMain.handle('settings:pickImportFile', () => pickSettingsImportFile())
  ipcMain.handle('settings:import', (_event, filePath: string) => importSettings(filePath))

  ipcMain.handle('backup:export', () => exportBackup())
  ipcMain.handle('backup:pickImportFile', () => pickImportFile())
  ipcMain.handle('backup:import', (_event, filePath: string, mode: BackupMode) =>
    importBackup(filePath, mode)
  )
  ipcMain.handle('backup:wipeAll', () => wipeAllAppData())

  ipcMain.handle('updates:check', () => checkForUpdatesNow())
  ipcMain.handle('updates:download', () => downloadUpdateNow())
  ipcMain.handle('updates:installNow', () => installUpdateNow())
  ipcMain.handle('updates:getStatus', () => getUpdateStatus())
  ipcMain.handle('updates:getReleaseNotes', () => getReleaseNotes())
}
