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
import { getChannelStats, getChannelStatus } from './db/channel'
import { createIdea, listIdeas, removeIdea, updateIdea } from './db/ideas'
import {
  createInspirationBoard,
  listInspirationBoards,
  removeInspirationBoard,
  renameInspirationBoard,
  reorderInspirationBoards
} from './db/inspirationBoards'
import {
  createInspirationGroup,
  listInspirationGroups,
  removeInspirationGroup,
  updateInspirationGroup
} from './db/inspirationGroups'
import {
  createInspiration,
  createInspirationLink,
  listInspirationLinks,
  listInspirations,
  removeInspiration,
  removeInspirationLink,
  updateInspiration,
  updateInspirationPosition
} from './db/inspirations'
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
  rescheduleTask,
  setTaskStatus,
  updateTask
} from './db/tasks'
import { createTaskType, listTaskTypes, removeTaskType, reorderTaskTypes } from './db/taskTypes'
import { mergeDuplicateIdeas } from './dedupe'
import {
  exportInspirationsBoard,
  importInspirationsBoard,
  pickInspirationsImportFile
} from './inspirationsBackup'
import {
  exportSettings,
  importSettings,
  loadSettings,
  pickSettingsImportFile,
  updateSettings
} from './settings'
import { getLastSyncResult, performFileSyncTracked, pickSyncFile } from './sync'
import { fetchYouTubeVideoMeta } from './youtube/oembed'
import { connectChannel, disconnectChannel } from './youtube/oauth'
import {
  createIdeaFromVideo,
  linkVideoToIdea,
  refreshChannelStats,
  refreshRecentVideos,
  searchChannelVideos,
  setVideoTags,
  unlinkVideo
} from './youtube/videos'
import type {
  AppSettings,
  BackupMode,
  InspirationGroupInput,
  InspirationInput,
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
  ipcMain.handle('channel:getStats', () => getChannelStats())
  ipcMain.handle('channel:refreshStats', async () => {
    try {
      return { stats: await refreshChannelStats() }
    } catch (error) {
      return {
        stats: getChannelStats(),
        error: error instanceof Error ? error.message : String(error)
      }
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

  ipcMain.handle('inspirations:listBoards', () => listInspirationBoards())
  ipcMain.handle('inspirations:createBoard', (_event, name: string) => createInspirationBoard(name))
  ipcMain.handle('inspirations:renameBoard', (_event, id: number, name: string) =>
    renameInspirationBoard(id, name)
  )
  ipcMain.handle('inspirations:reorderBoards', (_event, orderedIds: number[]) =>
    reorderInspirationBoards(orderedIds)
  )
  ipcMain.handle('inspirations:removeBoard', (_event, id: number) => removeInspirationBoard(id))

  ipcMain.handle('inspirations:list', (_event, boardId: number) => listInspirations(boardId))
  ipcMain.handle('inspirations:create', (_event, input: InspirationInput) =>
    createInspiration(input)
  )
  ipcMain.handle('inspirations:update', (_event, id: number, input: InspirationInput) =>
    updateInspiration(id, input)
  )
  ipcMain.handle('inspirations:updatePosition', (_event, id: number, posX: number, posY: number) =>
    updateInspirationPosition(id, posX, posY)
  )
  ipcMain.handle('inspirations:remove', (_event, id: number) => removeInspiration(id))
  ipcMain.handle('inspirations:listLinks', (_event, boardId: number) =>
    listInspirationLinks(boardId)
  )
  ipcMain.handle('inspirations:createLink', (_event, fromId: number, toId: number) =>
    createInspirationLink(fromId, toId)
  )
  ipcMain.handle('inspirations:removeLink', (_event, id: number) => removeInspirationLink(id))
  ipcMain.handle('inspirations:listGroups', (_event, boardId: number) =>
    listInspirationGroups(boardId)
  )
  ipcMain.handle('inspirations:createGroup', (_event, input: InspirationGroupInput) =>
    createInspirationGroup(input)
  )
  ipcMain.handle('inspirations:updateGroup', (_event, id: number, input: InspirationGroupInput) =>
    updateInspirationGroup(id, input)
  )
  ipcMain.handle('inspirations:removeGroup', (_event, id: number) => removeInspirationGroup(id))
  ipcMain.handle('inspirations:fetchYoutubeMeta', (_event, url: string) =>
    fetchYouTubeVideoMeta(url)
  )
  ipcMain.handle('inspirations:exportBoard', (_event, boardId: number) =>
    exportInspirationsBoard(boardId)
  )
  ipcMain.handle('inspirations:pickImportBoardFile', () => pickInspirationsImportFile())
  ipcMain.handle(
    'inspirations:importBoard',
    (_event, filePath: string, mode: BackupMode, targetBoardId: number) =>
      importInspirationsBoard(filePath, mode, targetBoardId)
  )

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

  ipcMain.handle('sync:pickFile', () => pickSyncFile())
  ipcMain.handle('sync:now', () => {
    const { syncFilePath } = loadSettings()
    if (!syncFilePath) {
      return {
        success: false,
        error: 'Aucun fichier de synchronisation choisi.',
        createdLocal: 0,
        updatedLocal: 0,
        deletedLocal: 0
      }
    }
    return performFileSyncTracked(syncFilePath)
  })
  ipcMain.handle('sync:getLastResult', () => getLastSyncResult())

  ipcMain.handle('updates:check', () => checkForUpdatesNow())
  ipcMain.handle('updates:download', () => downloadUpdateNow())
  ipcMain.handle('updates:installNow', () => installUpdateNow())
  ipcMain.handle('updates:getStatus', () => getUpdateStatus())
  ipcMain.handle('updates:getReleaseNotes', () => getReleaseNotes())
}
