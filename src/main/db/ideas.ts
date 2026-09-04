import { getDb } from './index'
import type { VideoIdea, VideoIdeaInput } from '../../shared/types'

interface IdeaRow {
  id: number
  title: string
  description: string | null
  status: string
  publish_date: string | null
  shoot_date: string | null
  created_at: string
  updated_at: string
}

function getObjectIds(ideaId: number): number[] {
  const rows = getDb()
    .prepare('SELECT object_id FROM idea_objects WHERE idea_id = ?')
    .all(ideaId) as { object_id: number }[]
  return rows.map((r) => r.object_id)
}

function toVideoIdea(row: IdeaRow): VideoIdea {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as VideoIdea['status'],
    publishDate: row.publish_date,
    shootDate: row.shoot_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    objectIds: getObjectIds(row.id)
  }
}

export function listIdeas(): VideoIdea[] {
  const rows = getDb().prepare('SELECT * FROM ideas ORDER BY created_at DESC').all() as IdeaRow[]
  return rows.map(toVideoIdea)
}

function setIdeaObjects(ideaId: number, objectIds: number[]): void {
  const db = getDb()
  db.prepare('DELETE FROM idea_objects WHERE idea_id = ?').run(ideaId)
  const insert = db.prepare('INSERT INTO idea_objects (idea_id, object_id) VALUES (?, ?)')
  for (const objectId of objectIds) {
    insert.run(ideaId, objectId)
  }
}

export function createIdea(input: VideoIdeaInput): VideoIdea {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO ideas (title, description, status, publish_date, shoot_date)
       VALUES (@title, @description, @status, @publishDate, @shootDate)`
    )
    .run({
      title: input.title,
      description: input.description,
      status: input.status,
      publishDate: input.publishDate,
      shootDate: input.shootDate
    })

  const ideaId = result.lastInsertRowid as number
  setIdeaObjects(ideaId, input.objectIds)
  return getIdeaById(ideaId)
}

export function updateIdea(id: number, input: VideoIdeaInput): VideoIdea {
  const db = getDb()
  db.prepare(
    `UPDATE ideas SET
       title = @title,
       description = @description,
       status = @status,
       publish_date = @publishDate,
       shoot_date = @shootDate,
       updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    title: input.title,
    description: input.description,
    status: input.status,
    publishDate: input.publishDate,
    shootDate: input.shootDate
  })

  setIdeaObjects(id, input.objectIds)
  return getIdeaById(id)
}

export function removeIdea(id: number): void {
  getDb().prepare('DELETE FROM ideas WHERE id = ?').run(id)
}

function getIdeaById(id: number): VideoIdea {
  const row = getDb().prepare('SELECT * FROM ideas WHERE id = ?').get(id) as IdeaRow
  return toVideoIdea(row)
}
