import { app, dialog } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { getDb } from './db/index'
import { getChannelStatus, saveChannelConnection } from './db/channel'
import { createIdea, listIdeas } from './db/ideas'
import { createObject, listObjects } from './db/objects'
import {
  getPublishedVideoIdByYoutubeId,
  linkVideoToIdea,
  listPublishedVideos,
  setPublishedVideoTags,
  upsertPublishedVideo
} from './db/publishedVideos'
import { createSeries, listSeries } from './db/series'
import { createTag, listTags } from './db/tags'
import type {
  BackupExportResult,
  BackupImportResult,
  BackupMode,
  OwnedObject,
  PublishedVideo,
  Series,
  Tag,
  VideoIdea
} from '../shared/types'

const BACKUP_VERSION = 1

interface RawChannelConnection {
  channel_id: string | null
  channel_title: string | null
  access_token: string | null
  refresh_token: string | null
  token_expiry: string | null
}

interface BackupChannelConnection {
  channelId: string
  channelTitle: string
  accessToken: string
  refreshToken: string
  tokenExpiry: string
}

interface BackupData {
  version: number
  exportedAt: string
  objects: OwnedObject[]
  tags: Tag[]
  series: Series[]
  ideas: VideoIdea[]
  publishedVideos: PublishedVideo[]
  channelConnection: BackupChannelConnection | null
}

function getRawChannelConnection(): BackupChannelConnection | null {
  const row = getDb().prepare('SELECT * FROM channel_connection WHERE id = 1').get() as
    RawChannelConnection | undefined
  if (!row?.access_token || !row.refresh_token || !row.token_expiry) return null
  return {
    channelId: row.channel_id ?? '',
    channelTitle: row.channel_title ?? '',
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiry: row.token_expiry
  }
}

function buildBackupData(): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    objects: listObjects(),
    tags: listTags(),
    series: listSeries(),
    ideas: listIdeas(),
    publishedVideos: listPublishedVideos(),
    channelConnection: getRawChannelConnection()
  }
}

/** Directory to suggest for a backup file: next to the app's executable when packaged. */
function getExportDir(): string {
  if (!app.isPackaged) return process.cwd()

  const exePath = app.getPath('exe')
  if (process.platform === 'darwin') {
    const bundleMarker = '.app/'
    const bundleIndex = exePath.indexOf(bundleMarker)
    if (bundleIndex !== -1) {
      // Use the folder that CONTAINS the .app bundle, not the bundle's internal MacOS/ dir.
      return dirname(exePath.slice(0, bundleIndex + bundleMarker.length - 1))
    }
  }
  return dirname(exePath)
}

function timestampedFileName(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  return `ShorterManager-backup-${stamp}.json`
}

export function exportBackup(): BackupExportResult {
  const data = buildBackupData()
  const json = JSON.stringify(data, null, 2)
  const fileName = timestampedFileName()

  const candidateDirs = [getExportDir(), app.getPath('documents'), app.getPath('userData')]

  for (const dir of candidateDirs) {
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      const path = join(dir, fileName)
      writeFileSync(path, json, 'utf-8')
      return { success: true, path }
    } catch {
      // Try the next candidate directory (e.g. the executable's folder may not be writable).
      continue
    }
  }

  return { success: false, error: "Impossible d'écrire le fichier de sauvegarde." }
}

export async function pickImportFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choisir un fichier de sauvegarde ShorterManager',
    defaultPath: getExportDir(),
    properties: ['openFile'],
    filters: [{ name: 'Sauvegarde ShorterManager', extensions: ['json'] }]
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

function isValidBackupData(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') return false
  const d = data as Partial<BackupData>
  return (
    Array.isArray(d.ideas) &&
    Array.isArray(d.objects) &&
    Array.isArray(d.tags) &&
    Array.isArray(d.series) &&
    Array.isArray(d.publishedVideos)
  )
}

function wipeAllData(db: ReturnType<typeof getDb>): void {
  db.exec(`
    DELETE FROM published_video_tags;
    DELETE FROM published_videos;
    DELETE FROM idea_tags;
    DELETE FROM idea_objects;
    DELETE FROM ideas;
    DELETE FROM tags;
    DELETE FROM objects;
    DELETE FROM series;
    DELETE FROM channel_connection;
  `)
}

export function wipeAllAppData(): { success: boolean; error?: string } {
  try {
    const db = getDb()
    db.transaction(() => wipeAllData(db))()
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function importReplace(data: BackupData): BackupImportResult {
  const db = getDb()

  const txn = db.transaction(() => {
    wipeAllData(db)

    for (const obj of data.objects) {
      db.prepare(
        `INSERT INTO objects (id, name, description, purchase_date, price, link, purchased, created_at, updated_at)
         VALUES (@id, @name, @description, @purchaseDate, @price, @link, @purchased, @createdAt, @updatedAt)`
      ).run({
        id: obj.id,
        name: obj.name,
        description: obj.description,
        purchaseDate: obj.purchaseDate,
        price: obj.price,
        link: obj.link,
        purchased: obj.purchased ? 1 : 0,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
      })
    }

    for (const tag of data.tags) {
      db.prepare(
        'INSERT INTO tags (id, name, color, created_at) VALUES (@id, @name, @color, @createdAt)'
      ).run({ id: tag.id, name: tag.name, color: tag.color, createdAt: tag.createdAt })
    }

    for (const s of data.series) {
      db.prepare('INSERT INTO series (id, name, created_at) VALUES (@id, @name, @createdAt)').run({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt
      })
    }

    const insertIdea = db.prepare(
      `INSERT INTO ideas (id, title, description, emoji, status, publish_date, shoot_date, series_id, created_at, updated_at)
       VALUES (@id, @title, @description, @emoji, @status, @publishDate, @shootDate, @seriesId, @createdAt, @updatedAt)`
    )
    const insertIdeaObject = db.prepare(
      'INSERT INTO idea_objects (idea_id, object_id) VALUES (?, ?)'
    )
    const insertIdeaTag = db.prepare('INSERT INTO idea_tags (idea_id, tag_id) VALUES (?, ?)')

    for (const idea of data.ideas) {
      insertIdea.run({
        id: idea.id,
        title: idea.title,
        description: idea.description,
        emoji: idea.emoji,
        status: idea.status,
        publishDate: idea.publishDate,
        shootDate: idea.shootDate,
        seriesId: idea.seriesId,
        createdAt: idea.createdAt,
        updatedAt: idea.updatedAt
      })
      for (const objectId of idea.objectIds) insertIdeaObject.run(idea.id, objectId)
      for (const tagId of idea.tagIds) insertIdeaTag.run(idea.id, tagId)
    }

    const insertVideo = db.prepare(
      `INSERT INTO published_videos
         (id, idea_id, youtube_video_id, title, description, thumbnail_url, published_at,
          view_count, like_count, comment_count, average_view_percentage, stats_fetched_at)
       VALUES
         (@id, @ideaId, @youtubeVideoId, @title, @description, @thumbnailUrl, @publishedAt,
          @viewCount, @likeCount, @commentCount, @averageViewPercentage, @statsFetchedAt)`
    )
    const insertVideoTag = db.prepare(
      'INSERT INTO published_video_tags (published_video_id, tag_id) VALUES (?, ?)'
    )

    for (const video of data.publishedVideos) {
      insertVideo.run({
        id: video.id,
        ideaId: video.ideaId,
        youtubeVideoId: video.youtubeVideoId,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        averageViewPercentage: video.averageViewPercentage,
        statsFetchedAt: video.statsFetchedAt
      })
      // A linked video's tags live on the idea (idea_tags) — only unlinked videos keep their
      // own direct tag rows, mirroring toPublishedVideo()'s bridge logic.
      if (video.ideaId === null) {
        for (const tagId of video.tagIds) insertVideoTag.run(video.id, tagId)
      }
    }

    if (data.channelConnection) {
      db.prepare(
        `INSERT INTO channel_connection
           (id, channel_id, channel_title, access_token, refresh_token, token_expiry, connected_at)
         VALUES (1, @channelId, @channelTitle, @accessToken, @refreshToken, @tokenExpiry, datetime('now'))`
      ).run(data.channelConnection)
    }
  })

  txn()

  return {
    success: true,
    mode: 'replace',
    addedIdeas: data.ideas.length,
    skippedIdeas: 0,
    addedObjects: data.objects.length,
    addedTags: data.tags.length,
    addedSeries: data.series.length,
    addedVideos: data.publishedVideos.length,
    channelRestored: Boolean(data.channelConnection)
  }
}

function importMerge(data: BackupData): BackupImportResult {
  const db = getDb()

  let addedObjects = 0
  let addedTags = 0
  let addedSeries = 0
  let addedIdeas = 0
  let skippedIdeas = 0
  let addedVideos = 0
  let relinkedVideos = 0
  let channelRestored = false

  const txn = db.transaction(() => {
    // Every "reuse by natural key" map below is built ONCE from the state the target DB had
    // BEFORE this import, and is never fed newly-created rows afterwards. This matters: if the
    // backup itself contains two different source records that happen to share the same name/
    // title (a channel can easily have several videos with the same generic title), each must
    // still become its own row — they must only be deduped against something that already
    // existed locally, never against a sibling from the very same import batch.

    // Objects have no DB uniqueness constraint, but reuse an existing same-name object anyway —
    // otherwise re-merging the same (or an overlapping) backup would duplicate every object
    // each time, which defeats the point of "merge" vs. "replace".
    const objectIdMap = new Map<number, number>()
    const objectsByName = new Map(listObjects().map((o) => [o.name.trim(), o]))
    for (const obj of data.objects) {
      const existing = objectsByName.get(obj.name.trim())
      if (existing) {
        objectIdMap.set(obj.id, existing.id)
        continue
      }
      const created = createObject({
        name: obj.name,
        description: obj.description,
        purchaseDate: obj.purchaseDate,
        price: obj.price,
        link: obj.link,
        purchased: obj.purchased
      })
      objectIdMap.set(obj.id, created.id)
      addedObjects++
    }

    // Tags and series both have a UNIQUE(name) DB constraint, so the backup itself can never
    // contain two of its own with the same name — reuse an existing one instead of erroring.
    const tagIdMap = new Map<number, number>()
    const tagsByName = new Map(listTags().map((t) => [t.name.trim(), t]))
    for (const tag of data.tags) {
      const existing = tagsByName.get(tag.name.trim())
      if (existing) {
        tagIdMap.set(tag.id, existing.id)
        continue
      }
      const created = createTag({ name: tag.name, color: tag.color })
      tagIdMap.set(tag.id, created.id)
      addedTags++
    }

    const seriesIdMap = new Map<number, number>()
    const seriesByName = new Map(listSeries().map((s) => [s.name.trim(), s]))
    for (const s of data.series) {
      const existing = seriesByName.get(s.name.trim())
      if (existing) {
        seriesIdMap.set(s.id, existing.id)
        continue
      }
      const created = createSeries(s.name)
      seriesIdMap.set(s.id, created.id)
      addedSeries++
    }

    // Hard rule: never create a second idea with a title that already exists LOCALLY — but two
    // source ideas sharing a title with each other (not with anything local) both get created,
    // otherwise their videos would collapse onto a single surviving idea.
    const ideaIdMap = new Map<number, number>()
    const ideasByTitle = new Map(listIdeas().map((i) => [i.title.trim(), i]))
    for (const idea of data.ideas) {
      const existing = ideasByTitle.get(idea.title.trim())
      if (existing) {
        ideaIdMap.set(idea.id, existing.id)
        skippedIdeas++
        continue
      }
      const created = createIdea({
        title: idea.title,
        emoji: idea.emoji,
        description: idea.description,
        status: idea.status,
        publishDate: idea.publishDate,
        shootDate: idea.shootDate,
        seriesId: idea.seriesId !== null ? (seriesIdMap.get(idea.seriesId) ?? null) : null,
        objectIds: idea.objectIds
          .map((id) => objectIdMap.get(id))
          .filter((id): id is number => id !== undefined),
        tagIds: idea.tagIds
          .map((id) => tagIdMap.get(id))
          .filter((id): id is number => id !== undefined)
      })
      ideaIdMap.set(idea.id, created.id)
      addedIdeas++
    }

    // Published videos are naturally keyed by youtubeVideoId. A video that already exists
    // locally is left as-is EXCEPT its idea link: if it isn't linked locally but the backup
    // says it should be, that link is still applied — a video existing (e.g. from a channel
    // refresh) must never block restoring the association the backup remembers.
    const existingVideosByYtId = new Map(listPublishedVideos().map((v) => [v.youtubeVideoId, v]))
    for (const video of data.publishedVideos) {
      const existingVideo = existingVideosByYtId.get(video.youtubeVideoId)

      if (!existingVideo) {
        upsertPublishedVideo({
          youtubeVideoId: video.youtubeVideoId,
          title: video.title,
          description: video.description,
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          averageViewPercentage: video.averageViewPercentage
        })
        addedVideos++
      }

      const currentVideoId = existingVideo
        ? existingVideo.id
        : getPublishedVideoIdByYoutubeId(video.youtubeVideoId)
      if (currentVideoId === null) continue

      if (video.ideaId !== null) {
        const mappedIdeaId = ideaIdMap.get(video.ideaId)
        const alreadyLinkedLocally = existingVideo ? existingVideo.ideaId !== null : false
        if (mappedIdeaId !== undefined && !alreadyLinkedLocally) {
          linkVideoToIdea(video.youtubeVideoId, mappedIdeaId)
          if (existingVideo) relinkedVideos++
        }
      } else if (!existingVideo && video.tagIds.length > 0) {
        const mappedTagIds = video.tagIds
          .map((id) => tagIdMap.get(id))
          .filter((id): id is number => id !== undefined)
        setPublishedVideoTags(currentVideoId, mappedTagIds)
      }
    }

    // Never clobber an already-connected channel with an imported one.
    if (data.channelConnection && !getChannelStatus().connected) {
      saveChannelConnection(data.channelConnection)
      channelRestored = true
    }
  })

  txn()

  return {
    success: true,
    mode: 'merge',
    addedIdeas,
    skippedIdeas,
    addedObjects,
    addedTags,
    addedSeries,
    addedVideos,
    relinkedVideos,
    channelRestored
  }
}

export function importBackup(filePath: string, mode: BackupMode): BackupImportResult {
  let data: unknown
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return { success: false, error: 'Impossible de lire ce fichier (JSON invalide).' }
  }

  if (!isValidBackupData(data)) {
    return { success: false, error: "Ce fichier n'est pas une sauvegarde ShorterManager valide." }
  }

  try {
    return mode === 'replace' ? importReplace(data) : importMerge(data)
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
