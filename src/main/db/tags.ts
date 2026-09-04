import { getDb } from './index'
import type { Tag, TagInput } from '../../shared/types'

interface TagRow {
  id: number
  name: string
  color: string
  created_at: string
}

function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at
  }
}

export function listTags(): Tag[] {
  const rows = getDb().prepare('SELECT * FROM tags ORDER BY name ASC').all() as TagRow[]
  return rows.map(toTag)
}

export function createTag(input: TagInput): Tag {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO tags (name, color) VALUES (@name, @color)')
    .run({ name: input.name, color: input.color })

  return getTagById(result.lastInsertRowid as number)
}

export function updateTag(id: number, input: TagInput): Tag {
  const db = getDb()
  db.prepare('UPDATE tags SET name = @name, color = @color WHERE id = @id').run({
    id,
    name: input.name,
    color: input.color
  })

  return getTagById(id)
}

export function removeTag(id: number): void {
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(id)
}

function getTagById(id: number): Tag {
  const row = getDb().prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow
  return toTag(row)
}
