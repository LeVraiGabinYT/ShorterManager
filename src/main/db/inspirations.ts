import { getDb } from './index'
import type {
  Inspiration,
  InspirationDetail,
  InspirationInput,
  InspirationLink,
  InspirationObject,
  InspirationVideo
} from '../../shared/types'

interface InspirationRow {
  id: number
  board_id: number
  kind: Inspiration['kind']
  title: string
  emoji: string | null
  description_html: string
  video_url: string | null
  video_thumbnail_url: string | null
  background_color: string | null
  font_color: string | null
  font_size: number | null
  linked_idea_id: number | null
  pos_x: number
  pos_y: number
  created_at: string
  updated_at: string
}

function getVideos(inspirationId: number): InspirationVideo[] {
  const rows = getDb()
    .prepare(
      'SELECT id, url, label FROM inspiration_videos WHERE inspiration_id = ? ORDER BY position ASC, id ASC'
    )
    .all(inspirationId) as { id: number; url: string; label: string | null }[]
  return rows.map((r) => ({ id: r.id, url: r.url, label: r.label }))
}

function getObjects(inspirationId: number): InspirationObject[] {
  const rows = getDb()
    .prepare(
      'SELECT id, name, link FROM inspiration_objects WHERE inspiration_id = ? ORDER BY position ASC, id ASC'
    )
    .all(inspirationId) as { id: number; name: string; link: string | null }[]
  return rows.map((r) => ({ id: r.id, name: r.name, link: r.link }))
}

function getDetails(inspirationId: number): InspirationDetail[] {
  const rows = getDb()
    .prepare(
      'SELECT id, name, type, value FROM inspiration_details WHERE inspiration_id = ? ORDER BY position ASC, id ASC'
    )
    .all(inspirationId) as {
    id: number
    name: string
    type: InspirationDetail['type']
    value: string
  }[]
  return rows.map((r) => ({ id: r.id, name: r.name, type: r.type, value: r.value }))
}

function toInspiration(row: InspirationRow): Inspiration {
  return {
    id: row.id,
    boardId: row.board_id,
    kind: row.kind,
    title: row.title,
    emoji: row.emoji,
    descriptionHtml: row.description_html,
    videoUrl: row.video_url,
    videoThumbnailUrl: row.video_thumbnail_url,
    backgroundColor: row.background_color,
    fontColor: row.font_color,
    fontSize: row.font_size,
    linkedIdeaId: row.linked_idea_id,
    posX: row.pos_x,
    posY: row.pos_y,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    videos: getVideos(row.id),
    objects: getObjects(row.id),
    details: getDetails(row.id)
  }
}

export function listInspirations(boardId: number): Inspiration[] {
  const rows = getDb()
    .prepare('SELECT * FROM inspirations WHERE board_id = ? ORDER BY created_at ASC')
    .all(boardId) as InspirationRow[]
  return rows.map(toInspiration)
}

function setVideos(inspirationId: number, videos: InspirationInput['videos']): void {
  const db = getDb()
  db.prepare('DELETE FROM inspiration_videos WHERE inspiration_id = ?').run(inspirationId)
  const insert = db.prepare(
    'INSERT INTO inspiration_videos (inspiration_id, url, label, position) VALUES (?, ?, ?, ?)'
  )
  videos.forEach((video, index) => insert.run(inspirationId, video.url, video.label, index))
}

function setObjects(inspirationId: number, objects: InspirationInput['objects']): void {
  const db = getDb()
  db.prepare('DELETE FROM inspiration_objects WHERE inspiration_id = ?').run(inspirationId)
  const insert = db.prepare(
    'INSERT INTO inspiration_objects (inspiration_id, name, link, position) VALUES (?, ?, ?, ?)'
  )
  objects.forEach((obj, index) => insert.run(inspirationId, obj.name, obj.link, index))
}

function setDetails(inspirationId: number, details: InspirationInput['details']): void {
  const db = getDb()
  db.prepare('DELETE FROM inspiration_details WHERE inspiration_id = ?').run(inspirationId)
  const insert = db.prepare(
    'INSERT INTO inspiration_details (inspiration_id, name, type, value, position) VALUES (?, ?, ?, ?, ?)'
  )
  details.forEach((detail, index) =>
    insert.run(inspirationId, detail.name, detail.type, detail.value, index)
  )
}

export function createInspiration(input: InspirationInput): Inspiration {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO inspirations
         (board_id, kind, title, emoji, description_html, video_url, video_thumbnail_url,
          background_color, font_color, font_size, linked_idea_id, pos_x, pos_y)
       VALUES
         (@boardId, @kind, @title, @emoji, @descriptionHtml, @videoUrl, @videoThumbnailUrl,
          @backgroundColor, @fontColor, @fontSize, @linkedIdeaId, @posX, @posY)`
    )
    .run({
      boardId: input.boardId,
      kind: input.kind,
      title: input.title,
      emoji: input.emoji,
      descriptionHtml: input.descriptionHtml,
      videoUrl: input.videoUrl,
      videoThumbnailUrl: input.videoThumbnailUrl,
      backgroundColor: input.backgroundColor,
      fontColor: input.fontColor,
      fontSize: input.fontSize,
      linkedIdeaId: input.linkedIdeaId,
      posX: input.posX,
      posY: input.posY
    })

  const id = result.lastInsertRowid as number
  setVideos(id, input.videos)
  setObjects(id, input.objects)
  setDetails(id, input.details)
  return getInspirationById(id)
}

export function updateInspiration(id: number, input: InspirationInput): Inspiration {
  getDb()
    .prepare(
      `UPDATE inspirations SET
         kind = @kind,
         title = @title,
         emoji = @emoji,
         description_html = @descriptionHtml,
         video_url = @videoUrl,
         video_thumbnail_url = @videoThumbnailUrl,
         background_color = @backgroundColor,
         font_color = @fontColor,
         font_size = @fontSize,
         linked_idea_id = @linkedIdeaId,
         pos_x = @posX,
         pos_y = @posY,
         updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({
      id,
      kind: input.kind,
      title: input.title,
      emoji: input.emoji,
      descriptionHtml: input.descriptionHtml,
      videoUrl: input.videoUrl,
      videoThumbnailUrl: input.videoThumbnailUrl,
      backgroundColor: input.backgroundColor,
      fontColor: input.fontColor,
      fontSize: input.fontSize,
      linkedIdeaId: input.linkedIdeaId,
      posX: input.posX,
      posY: input.posY
    })

  setVideos(id, input.videos)
  setObjects(id, input.objects)
  setDetails(id, input.details)
  return getInspirationById(id)
}

// Separate from the full update() above — dragging a node on the canvas only ever needs to
// persist its new position, not resend the title/description/videos/objects/details on every
// pixel of movement.
export function updateInspirationPosition(id: number, posX: number, posY: number): void {
  getDb()
    .prepare(
      `UPDATE inspirations SET pos_x = @posX, pos_y = @posY, updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({ id, posX, posY })
}

export function removeInspiration(id: number): void {
  getDb().prepare('DELETE FROM inspirations WHERE id = ?').run(id)
}

export function getInspirationById(id: number): Inspiration {
  const row = getDb().prepare('SELECT * FROM inspirations WHERE id = ?').get(id) as InspirationRow
  return toInspiration(row)
}

export function listInspirationLinks(boardId: number): InspirationLink[] {
  const rows = getDb()
    .prepare(
      `SELECT l.id, l.from_id, l.to_id
       FROM inspiration_links l
       JOIN inspirations a ON a.id = l.from_id
       JOIN inspirations b ON b.id = l.to_id
       WHERE a.board_id = ? AND b.board_id = ?`
    )
    .all(boardId, boardId) as { id: number; from_id: number; to_id: number }[]
  return rows.map((r) => ({ id: r.id, fromId: r.from_id, toId: r.to_id }))
}

// Canonicalizes the pair (fromId < toId) so a link between two cards is never stored twice
// regardless of which card the drag started from, and returns the existing link if one already
// connects them instead of creating a duplicate.
export function createInspirationLink(fromId: number, toId: number): InspirationLink | null {
  if (fromId === toId) return null
  const a = Math.min(fromId, toId)
  const b = Math.max(fromId, toId)

  const db = getDb()
  const existing = db
    .prepare('SELECT id FROM inspiration_links WHERE from_id = ? AND to_id = ?')
    .get(a, b) as { id: number } | undefined
  if (existing) return { id: existing.id, fromId: a, toId: b }

  const result = db
    .prepare('INSERT INTO inspiration_links (from_id, to_id) VALUES (?, ?)')
    .run(a, b)
  return { id: result.lastInsertRowid as number, fromId: a, toId: b }
}

export function removeInspirationLink(id: number): void {
  getDb().prepare('DELETE FROM inspiration_links WHERE id = ?').run(id)
}

// --- Backup / import-export support (used by main/backup.ts and main/inspirationsBackup.ts) ---

// Wipes every inspiration ON THE GIVEN BOARD (cascades videos/objects/details/links) and
// re-inserts the given set with their EXACT original ids, all under that same board — used by a
// "replace" import so the restored board matches the backup file byte-for-byte instead of getting
// fresh autoincrement ids.
export function replaceAllInspirations(
  boardId: number,
  inspirations: Inspiration[],
  links: InspirationLink[]
): void {
  const db = getDb()
  db.prepare('DELETE FROM inspirations WHERE board_id = ?').run(boardId)

  const insertInspiration = db.prepare(
    `INSERT INTO inspirations
       (id, board_id, kind, title, emoji, description_html, video_url, video_thumbnail_url,
        background_color, font_color, font_size, linked_idea_id, pos_x, pos_y, created_at, updated_at)
     VALUES
       (@id, @boardId, @kind, @title, @emoji, @descriptionHtml, @videoUrl, @videoThumbnailUrl,
        @backgroundColor, @fontColor, @fontSize, @linkedIdeaId, @posX, @posY, @createdAt, @updatedAt)`
  )
  const insertVideo = db.prepare(
    'INSERT INTO inspiration_videos (id, inspiration_id, url, label, position) VALUES (?, ?, ?, ?, ?)'
  )
  const insertObject = db.prepare(
    'INSERT INTO inspiration_objects (id, inspiration_id, name, link, position) VALUES (?, ?, ?, ?, ?)'
  )
  const insertDetail = db.prepare(
    'INSERT INTO inspiration_details (id, inspiration_id, name, type, value, position) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insertLink = db.prepare(
    "INSERT INTO inspiration_links (id, from_id, to_id, created_at) VALUES (?, ?, ?, datetime('now'))"
  )

  for (const insp of inspirations) {
    insertInspiration.run({
      id: insp.id,
      boardId,
      kind: insp.kind,
      title: insp.title,
      emoji: insp.emoji,
      descriptionHtml: insp.descriptionHtml,
      videoUrl: insp.videoUrl,
      videoThumbnailUrl: insp.videoThumbnailUrl,
      backgroundColor: insp.backgroundColor,
      fontColor: insp.fontColor,
      fontSize: insp.fontSize,
      linkedIdeaId: insp.linkedIdeaId,
      posX: insp.posX,
      posY: insp.posY,
      createdAt: insp.createdAt,
      updatedAt: insp.updatedAt
    })
    insp.videos.forEach((v, i) => insertVideo.run(v.id, insp.id, v.url, v.label, i))
    insp.objects.forEach((o, i) => insertObject.run(o.id, insp.id, o.name, o.link, i))
    insp.details.forEach((d, i) => insertDetail.run(d.id, insp.id, d.name, d.type, d.value, i))
  }
  for (const link of links) {
    insertLink.run(link.id, link.fromId, link.toId)
  }
}

// Used by a "merge" import — a mind-map node has no natural "same as" key to dedupe against
// (unlike an idea's title), so every inspiration in the backup is always added as a brand-new
// node via the normal createInspiration() path (fresh id) onto the given board, and links are
// re-created against the resulting old-id -> new-id map.
export function addInspirationsFromBackup(
  boardId: number,
  inspirations: Inspiration[],
  links: InspirationLink[]
): { addedInspirations: number; addedLinks: number } {
  const idMap = new Map<number, number>()
  for (const insp of inspirations) {
    const created = createInspiration({
      boardId,
      kind: insp.kind,
      title: insp.title,
      emoji: insp.emoji,
      descriptionHtml: insp.descriptionHtml,
      videoUrl: insp.videoUrl,
      videoThumbnailUrl: insp.videoThumbnailUrl,
      backgroundColor: insp.backgroundColor,
      fontColor: insp.fontColor,
      fontSize: insp.fontSize,
      // A linked idea belongs to the dashboard, not to the backup's board scope — importing (from
      // another install, or a shared file) never assumes that idea id still means the same thing
      // locally, so the link is deliberately dropped rather than silently pointing at the wrong idea.
      linkedIdeaId: null,
      posX: insp.posX,
      posY: insp.posY,
      videos: insp.videos.map((v) => ({ url: v.url, label: v.label })),
      objects: insp.objects.map((o) => ({ name: o.name, link: o.link })),
      details: insp.details.map((d) => ({ name: d.name, type: d.type, value: d.value }))
    })
    idMap.set(insp.id, created.id)
  }

  let addedLinks = 0
  for (const link of links) {
    const from = idMap.get(link.fromId)
    const to = idMap.get(link.toId)
    if (from === undefined || to === undefined) continue
    createInspirationLink(from, to)
    addedLinks++
  }

  return { addedInspirations: inspirations.length, addedLinks }
}
