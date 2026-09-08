import { app, dialog } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { getDb } from './db/index'
import { createIdea, listIdeas, removeIdea, updateIdea } from './db/ideas'
import { createObject, listObjects, removeObject, updateObject } from './db/objects'
import {
  getPublishedVideoIdByYoutubeId,
  linkVideoToIdea,
  listPublishedVideos,
  setPublishedVideoTags,
  upsertPublishedVideo
} from './db/publishedVideos'
import {
  createSeries,
  listSeries,
  removeSeries,
  renameSeries,
  updateSeriesEmoji
} from './db/series'
import { createTag, listTags, removeTag, updateTag } from './db/tags'
import { createTask, listTasks, removeTask, updateTask } from './db/tasks'
import { createTaskType, listTaskTypes, removeTaskType, updateTaskType } from './db/taskTypes'
import type {
  OwnedObject,
  PublishedVideo,
  Series,
  SyncResult,
  Tag,
  Task,
  TaskType,
  VideoIdea
} from '../shared/types'

// A "sync snapshot" is exactly the app's user data (never the YouTube channel connection/tokens —
// those stay local-only, see performFileSync) in the same shape whether it comes from the local
// DB, the shared file, or the cached "last synced" baseline used to tell adds/edits from deletes
// apart (see diffByKey below).
interface SyncSnapshot {
  objects: OwnedObject[]
  tags: Tag[]
  series: Series[]
  ideas: VideoIdea[]
  taskTypes: TaskType[]
  tasks: Task[]
  publishedVideos: PublishedVideo[]
}

function emptySnapshot(): SyncSnapshot {
  return {
    objects: [],
    tags: [],
    series: [],
    ideas: [],
    taskTypes: [],
    tasks: [],
    publishedVideos: []
  }
}

function buildLocalSnapshot(): SyncSnapshot {
  return {
    objects: listObjects(),
    tags: listTags(),
    series: listSeries(),
    ideas: listIdeas(),
    taskTypes: listTaskTypes(),
    tasks: listTasks(),
    publishedVideos: listPublishedVideos()
  }
}

function isValidSnapshot(data: unknown): data is SyncSnapshot {
  if (!data || typeof data !== 'object') return false
  const d = data as Partial<SyncSnapshot>
  return (
    Array.isArray(d.objects) &&
    Array.isArray(d.tags) &&
    Array.isArray(d.series) &&
    Array.isArray(d.ideas) &&
    Array.isArray(d.taskTypes) &&
    Array.isArray(d.tasks) &&
    Array.isArray(d.publishedVideos)
  )
}

function loadSnapshotFile(filePath: string): SyncSnapshot | null {
  if (!existsSync(filePath)) return null
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
    return isValidSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeSnapshotFile(filePath: string, snapshot: SyncSnapshot): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
}

// Where the "last synced" baseline lives — next to the DB, not inside the shared file, since it's
// specific to THIS install's last successful merge, not something to share across devices.
function getBasePath(): string {
  return join(app.getPath('userData'), 'sync-base.json')
}

function loadBaseSnapshot(): SyncSnapshot | null {
  const p = getBasePath()
  if (!existsSync(p)) return null
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8'))
    return isValidSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveBaseSnapshot(snapshot: SyncSnapshot): void {
  writeFileSync(getBasePath(), JSON.stringify(snapshot, null, 2), 'utf-8')
}

/* ------------------------------------------------------------------------------------------- *
 * Generic 3-way diff — the core of the "intelligent merge": tells an add from an edit from a
 * delete by comparing both local and remote against the last-known-synced baseline, instead of
 * one side blindly overwriting the other.
 * ------------------------------------------------------------------------------------------- */

type SyncAction<T> =
  | { type: 'create'; remote: T }
  | { type: 'update'; local: T; remote: T }
  | { type: 'delete'; local: T }

function diffByKey<T>(
  baseList: T[],
  localList: T[],
  remoteList: T[],
  keyOf: (item: T) => string,
  equal: (a: T, b: T) => boolean,
  preferRemoteOnConflict: (local: T, remote: T) => boolean
): SyncAction<T>[] {
  const baseMap = new Map(baseList.map((i) => [keyOf(i), i]))
  const localMap = new Map(localList.map((i) => [keyOf(i), i]))
  const remoteMap = new Map(remoteList.map((i) => [keyOf(i), i]))
  const allKeys = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()])

  const actions: SyncAction<T>[] = []

  for (const key of allKeys) {
    const base = baseMap.get(key)
    const local = localMap.get(key)
    const remote = remoteMap.get(key)

    if (local && remote) {
      if (equal(local, remote)) continue
      const localChanged = !base || !equal(local, base)
      const remoteChanged = !base || !equal(remote, base)
      // Remote wins when it's the only side that changed, or — on a genuine conflict where both
      // sides changed differently since the baseline — when the tiebreak says so (recency via
      // updatedAt where available; otherwise local is kept, see preferRemoteOnConflict callers).
      if (remoteChanged && (!localChanged || preferRemoteOnConflict(local, remote))) {
        actions.push({ type: 'update', local, remote })
      }
      continue
    }

    if (!local && remote) {
      // Missing locally but unchanged remotely since the baseline means WE deleted it — honor
      // that instead of resurrecting it. Missing locally AND changed remotely (or brand new) means
      // it should exist locally — an edit elsewhere always wins over a delete here, to avoid
      // silently discarding someone's change.
      if (base && equal(base, remote)) continue
      actions.push({ type: 'create', remote })
      continue
    }

    if (local && !remote) {
      // Present locally, missing remotely: only delete it locally if local matches the baseline
      // (nothing changed here since last sync) AND it existed in the baseline (so its absence from
      // remote really means "deleted elsewhere", not "never synced yet").
      if (base && equal(base, local)) {
        actions.push({ type: 'delete', local })
      }
      continue
    }
  }

  return actions
}

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort((x, y) => x - y)
  const sb = [...b].sort((x, y) => x - y)
  return sa.every((v, i) => v === sb[i])
}

// Entities with an `updatedAt` get resolved by recency on a genuine conflict; entities without one
// (tags/series/task types have no updatedAt column) fall back to keeping the local version — see
// module doc comment on diffByKey for what "conflict" means here.
function preferRemoteByUpdatedAt(
  local: { updatedAt: string },
  remote: { updatedAt: string }
): boolean {
  return remote.updatedAt > local.updatedAt
}
const preferLocal = (): boolean => false

function buildIdMap<T extends { id: number }>(
  remoteList: T[],
  currentLocalList: T[],
  keyOf: (item: T) => string
): Map<number, number> {
  const localByKey = new Map(currentLocalList.map((item) => [keyOf(item), item.id]))
  const map = new Map<number, number>()
  for (const remote of remoteList) {
    const localId = localByKey.get(keyOf(remote))
    if (localId !== undefined) map.set(remote.id, localId)
  }
  return map
}

/* ------------------------------------------------------------------------------------------- *
 * Per-entity keys, equality and action application. Processed in dependency order (objects/tags/
 * series/taskTypes before ideas/tasks, ideas before tasks/publishedVideos) so each step's id map
 * is ready before the next step needs to translate the remote file's ids into local ones.
 * ------------------------------------------------------------------------------------------- */

const keyObject = (o: OwnedObject): string => o.name.trim()
const keyTag = (t: Tag): string => t.name.trim()
const keySeries = (s: Series): string => s.name.trim()
const keyTaskType = (t: TaskType): string => t.name.trim()
const keyIdea = (i: VideoIdea): string => i.title.trim()
const keyTask = (t: Task): string => `${t.title.trim()}|${t.dueDate ?? ''}`

function objectsEqual(a: OwnedObject, b: OwnedObject): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.description === b.description &&
    a.purchaseDate === b.purchaseDate &&
    a.price === b.price &&
    a.link === b.link &&
    a.purchased === b.purchased
  )
}
function tagsEqual(a: Tag, b: Tag): boolean {
  return a.name.trim() === b.name.trim() && a.color === b.color
}
function seriesEqual(a: Series, b: Series): boolean {
  return a.name.trim() === b.name.trim() && a.emoji === b.emoji
}
function taskTypesEqual(a: TaskType, b: TaskType): boolean {
  return a.name.trim() === b.name.trim() && a.emoji === b.emoji
}
function ideasEqual(a: VideoIdea, b: VideoIdea): boolean {
  return (
    a.title.trim() === b.title.trim() &&
    a.description === b.description &&
    a.emoji === b.emoji &&
    a.status === b.status &&
    a.publishDate === b.publishDate &&
    a.shootDate === b.shootDate &&
    a.seriesId === b.seriesId &&
    sameIdSet(a.objectIds, b.objectIds) &&
    sameIdSet(a.tagIds, b.tagIds)
  )
}
function tasksEqual(a: Task, b: Task): boolean {
  return (
    a.title.trim() === b.title.trim() &&
    a.emoji === b.emoji &&
    a.dueDate === b.dueDate &&
    a.dueTime === b.dueTime &&
    a.status === b.status &&
    sameIdSet(a.typeIds, b.typeIds) &&
    sameIdSet(a.ideaIds, b.ideaIds)
  )
}

function applyObjectActions(actions: SyncAction<OwnedObject>[]): {
  created: number
  updated: number
  deleted: number
} {
  let created = 0
  let updated = 0
  let deleted = 0
  for (const action of actions) {
    if (action.type === 'create') {
      createObject({
        name: action.remote.name,
        description: action.remote.description,
        purchaseDate: action.remote.purchaseDate,
        price: action.remote.price,
        link: action.remote.link,
        purchased: action.remote.purchased
      })
      created++
    } else if (action.type === 'update') {
      updateObject(action.local.id, {
        name: action.remote.name,
        description: action.remote.description,
        purchaseDate: action.remote.purchaseDate,
        price: action.remote.price,
        link: action.remote.link,
        purchased: action.remote.purchased
      })
      updated++
    } else {
      removeObject(action.local.id)
      deleted++
    }
  }
  return { created, updated, deleted }
}

function applyTagActions(actions: SyncAction<Tag>[]): {
  created: number
  updated: number
  deleted: number
} {
  let created = 0
  let updated = 0
  let deleted = 0
  for (const action of actions) {
    if (action.type === 'create') {
      createTag({ name: action.remote.name, color: action.remote.color })
      created++
    } else if (action.type === 'update') {
      updateTag(action.local.id, { name: action.remote.name, color: action.remote.color })
      updated++
    } else {
      removeTag(action.local.id)
      deleted++
    }
  }
  return { created, updated, deleted }
}

function applySeriesActions(actions: SyncAction<Series>[]): {
  created: number
  updated: number
  deleted: number
} {
  let created = 0
  let updated = 0
  let deleted = 0
  for (const action of actions) {
    if (action.type === 'create') {
      createSeries(action.remote.name, action.remote.emoji)
      created++
    } else if (action.type === 'update') {
      renameSeries(action.local.id, action.remote.name)
      updateSeriesEmoji(action.local.id, action.remote.emoji)
      updated++
    } else {
      removeSeries(action.local.id)
      deleted++
    }
  }
  return { created, updated, deleted }
}

function applyTaskTypeActions(actions: SyncAction<TaskType>[]): {
  created: number
  updated: number
  deleted: number
} {
  let created = 0
  let updated = 0
  let deleted = 0
  for (const action of actions) {
    if (action.type === 'create') {
      createTaskType({ name: action.remote.name, emoji: action.remote.emoji })
      created++
    } else if (action.type === 'update') {
      updateTaskType(action.local.id, { name: action.remote.name, emoji: action.remote.emoji })
      updated++
    } else {
      removeTaskType(action.local.id)
      deleted++
    }
  }
  return { created, updated, deleted }
}

function applyIdeaActions(actions: SyncAction<VideoIdea>[]): {
  created: number
  updated: number
  deleted: number
} {
  let created = 0
  let updated = 0
  let deleted = 0
  for (const action of actions) {
    if (action.type === 'create') {
      createIdea({
        title: action.remote.title,
        description: action.remote.description,
        emoji: action.remote.emoji,
        status: action.remote.status,
        publishDate: action.remote.publishDate,
        shootDate: action.remote.shootDate,
        seriesId: action.remote.seriesId,
        objectIds: action.remote.objectIds,
        tagIds: action.remote.tagIds
      })
      created++
    } else if (action.type === 'update') {
      updateIdea(action.local.id, {
        title: action.remote.title,
        description: action.remote.description,
        emoji: action.remote.emoji,
        status: action.remote.status,
        publishDate: action.remote.publishDate,
        shootDate: action.remote.shootDate,
        seriesId: action.remote.seriesId,
        objectIds: action.remote.objectIds,
        tagIds: action.remote.tagIds
      })
      updated++
    } else {
      removeIdea(action.local.id)
      deleted++
    }
  }
  return { created, updated, deleted }
}

function applyTaskActions(actions: SyncAction<Task>[]): {
  created: number
  updated: number
  deleted: number
} {
  let created = 0
  let updated = 0
  let deleted = 0
  for (const action of actions) {
    if (action.type === 'create') {
      createTask({
        title: action.remote.title,
        emoji: action.remote.emoji,
        dueDate: action.remote.dueDate,
        dueTime: action.remote.dueTime,
        status: action.remote.status,
        typeIds: action.remote.typeIds,
        ideaIds: action.remote.ideaIds
      })
      created++
    } else if (action.type === 'update') {
      updateTask(action.local.id, {
        title: action.remote.title,
        emoji: action.remote.emoji,
        dueDate: action.remote.dueDate,
        dueTime: action.remote.dueTime,
        status: action.remote.status,
        typeIds: action.remote.typeIds,
        ideaIds: action.remote.ideaIds
      })
      updated++
    } else {
      removeTask(action.local.id)
      deleted++
    }
  }
  return { created, updated, deleted }
}

// Published videos are a YouTube cache more than user data (they get re-fetched from the channel
// automatically), so this deliberately skips the full 3-way diff: it only ever adds a video that's
// missing locally, refreshes stats when the remote copy was fetched more recently, and fills in a
// link/tags left empty locally — it never deletes a video or overwrites an existing local link, so
// a device without the YouTube connection can still see linked videos synced from one that has it.
function syncPublishedVideos(translatedRemoteVideos: PublishedVideo[]): {
  created: number
  updated: number
} {
  let created = 0
  let updated = 0
  const localByYtId = new Map(listPublishedVideos().map((v) => [v.youtubeVideoId, v]))

  for (const remote of translatedRemoteVideos) {
    const local = localByYtId.get(remote.youtubeVideoId)

    if (!local) {
      upsertPublishedVideo({
        youtubeVideoId: remote.youtubeVideoId,
        title: remote.title,
        description: remote.description,
        thumbnailUrl: remote.thumbnailUrl,
        publishedAt: remote.publishedAt,
        viewCount: remote.viewCount,
        likeCount: remote.likeCount,
        commentCount: remote.commentCount,
        averageViewPercentage: remote.averageViewPercentage
      })
      created++
      const newId = getPublishedVideoIdByYoutubeId(remote.youtubeVideoId)
      if (newId !== null) {
        if (remote.ideaId !== null) {
          linkVideoToIdea(remote.youtubeVideoId, remote.ideaId)
        } else if (remote.tagIds.length > 0) {
          setPublishedVideoTags(newId, remote.tagIds)
        }
      }
      continue
    }

    if (
      remote.statsFetchedAt &&
      (!local.statsFetchedAt || remote.statsFetchedAt > local.statsFetchedAt)
    ) {
      upsertPublishedVideo({
        youtubeVideoId: remote.youtubeVideoId,
        title: remote.title,
        description: remote.description,
        thumbnailUrl: remote.thumbnailUrl,
        publishedAt: remote.publishedAt,
        viewCount: remote.viewCount,
        likeCount: remote.likeCount,
        commentCount: remote.commentCount,
        averageViewPercentage: remote.averageViewPercentage
      })
      updated++
    }

    if (local.ideaId === null && remote.ideaId !== null) {
      linkVideoToIdea(remote.youtubeVideoId, remote.ideaId)
    } else if (local.ideaId === null && remote.ideaId === null && local.tagIds.length === 0) {
      if (remote.tagIds.length > 0) setPublishedVideoTags(local.id, remote.tagIds)
    }
  }

  return { created, updated }
}

function mapIds(ids: number[], idMap: Map<number, number>): number[] {
  return ids.map((id) => idMap.get(id)).filter((id): id is number => id !== undefined)
}

/**
 * The full two-way "intelligent merge": reads the shared file and the last-synced baseline,
 * 3-way-diffs each entity type against the current local DB (see diffByKey), applies only the
 * adds/edits/deletes actually needed to the local database, then writes the resulting merged
 * state back out to the file and saves it as the new baseline — so both sides end up identical,
 * and next time only genuinely new changes (from either side) get merged again.
 *
 * Deliberately excludes the YouTube channel connection (OAuth tokens) — those never leave this
 * install, let alone end up in a file inside a synced folder.
 */
export function performFileSync(filePath: string): SyncResult {
  try {
    const db = getDb()
    const baseData = loadBaseSnapshot() ?? emptySnapshot()
    const remoteData = loadSnapshotFile(filePath) ?? emptySnapshot()

    let createdTotal = 0
    let updatedTotal = 0
    let deletedTotal = 0

    const txn = db.transaction(() => {
      const objectActions = diffByKey(
        baseData.objects,
        listObjects(),
        remoteData.objects,
        keyObject,
        objectsEqual,
        preferRemoteByUpdatedAt
      )
      const objectStats = applyObjectActions(objectActions)
      createdTotal += objectStats.created
      updatedTotal += objectStats.updated
      deletedTotal += objectStats.deleted
      const objectIdMap = buildIdMap(remoteData.objects, listObjects(), keyObject)

      const tagActions = diffByKey(
        baseData.tags,
        listTags(),
        remoteData.tags,
        keyTag,
        tagsEqual,
        preferLocal
      )
      const tagStats = applyTagActions(tagActions)
      createdTotal += tagStats.created
      updatedTotal += tagStats.updated
      deletedTotal += tagStats.deleted
      const tagIdMap = buildIdMap(remoteData.tags, listTags(), keyTag)

      const seriesActions = diffByKey(
        baseData.series,
        listSeries(),
        remoteData.series,
        keySeries,
        seriesEqual,
        preferLocal
      )
      const seriesStats = applySeriesActions(seriesActions)
      createdTotal += seriesStats.created
      updatedTotal += seriesStats.updated
      deletedTotal += seriesStats.deleted
      const seriesIdMap = buildIdMap(remoteData.series, listSeries(), keySeries)

      const translatedRemoteIdeas = remoteData.ideas.map((idea) => ({
        ...idea,
        objectIds: mapIds(idea.objectIds, objectIdMap),
        tagIds: mapIds(idea.tagIds, tagIdMap),
        seriesId: idea.seriesId !== null ? (seriesIdMap.get(idea.seriesId) ?? null) : null
      }))
      const ideaActions = diffByKey(
        baseData.ideas,
        listIdeas(),
        translatedRemoteIdeas,
        keyIdea,
        ideasEqual,
        preferRemoteByUpdatedAt
      )
      const ideaStats = applyIdeaActions(ideaActions)
      createdTotal += ideaStats.created
      updatedTotal += ideaStats.updated
      deletedTotal += ideaStats.deleted
      const ideaIdMap = buildIdMap(translatedRemoteIdeas, listIdeas(), keyIdea)

      const taskTypeActions = diffByKey(
        baseData.taskTypes,
        listTaskTypes(),
        remoteData.taskTypes,
        keyTaskType,
        taskTypesEqual,
        preferLocal
      )
      const taskTypeStats = applyTaskTypeActions(taskTypeActions)
      createdTotal += taskTypeStats.created
      updatedTotal += taskTypeStats.updated
      deletedTotal += taskTypeStats.deleted
      const taskTypeIdMap = buildIdMap(remoteData.taskTypes, listTaskTypes(), keyTaskType)

      const translatedRemoteTasks = remoteData.tasks.map((task) => ({
        ...task,
        typeIds: mapIds(task.typeIds, taskTypeIdMap),
        ideaIds: mapIds(task.ideaIds, ideaIdMap)
      }))
      const taskActions = diffByKey(
        baseData.tasks,
        listTasks(),
        translatedRemoteTasks,
        keyTask,
        tasksEqual,
        preferRemoteByUpdatedAt
      )
      const taskStats = applyTaskActions(taskActions)
      createdTotal += taskStats.created
      updatedTotal += taskStats.updated
      deletedTotal += taskStats.deleted

      const translatedRemoteVideos = remoteData.publishedVideos.map((video) => ({
        ...video,
        ideaId: video.ideaId !== null ? (ideaIdMap.get(video.ideaId) ?? null) : null,
        tagIds: mapIds(video.tagIds, tagIdMap)
      }))
      const videoStats = syncPublishedVideos(translatedRemoteVideos)
      createdTotal += videoStats.created
      updatedTotal += videoStats.updated
    })

    txn()

    const finalSnapshot = buildLocalSnapshot()
    writeSnapshotFile(filePath, finalSnapshot)
    saveBaseSnapshot(finalSnapshot)

    return {
      success: true,
      createdLocal: createdTotal,
      updatedLocal: updatedTotal,
      deletedLocal: deletedTotal,
      syncedAt: new Date().toISOString()
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      createdLocal: 0,
      updatedLocal: 0,
      deletedLocal: 0
    }
  }
}

let lastResult: SyncResult | null = null

export function performFileSyncTracked(filePath: string): SyncResult {
  lastResult = performFileSync(filePath)
  return lastResult
}

export function getLastSyncResult(): SyncResult | null {
  return lastResult
}

export async function pickSyncFile(): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: 'Choisir (ou créer) le fichier de synchronisation ShorterManager',
    defaultPath: 'ShorterManager-donnees.json',
    filters: [{ name: 'Données ShorterManager', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return null
  return result.filePath
}
