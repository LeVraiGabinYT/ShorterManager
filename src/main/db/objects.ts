import { getDb } from './index'
import type { OwnedObject, OwnedObjectInput } from '../../shared/types'

interface ObjectRow {
  id: number
  name: string
  description: string | null
  purchase_date: string | null
  price: number | null
  link: string | null
  created_at: string
  updated_at: string
}

function toOwnedObject(row: ObjectRow): OwnedObject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    purchaseDate: row.purchase_date,
    price: row.price,
    link: row.link,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listObjects(): OwnedObject[] {
  const rows = getDb()
    .prepare('SELECT * FROM objects ORDER BY created_at DESC')
    .all() as ObjectRow[]
  return rows.map(toOwnedObject)
}

export function createObject(input: OwnedObjectInput): OwnedObject {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO objects (name, description, purchase_date, price, link)
       VALUES (@name, @description, @purchaseDate, @price, @link)`
    )
    .run({
      name: input.name,
      description: input.description,
      purchaseDate: input.purchaseDate,
      price: input.price,
      link: input.link
    })

  return getObjectById(result.lastInsertRowid as number)
}

export function updateObject(id: number, input: OwnedObjectInput): OwnedObject {
  const db = getDb()
  db.prepare(
    `UPDATE objects SET
       name = @name,
       description = @description,
       purchase_date = @purchaseDate,
       price = @price,
       link = @link,
       updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    name: input.name,
    description: input.description,
    purchaseDate: input.purchaseDate,
    price: input.price,
    link: input.link
  })

  return getObjectById(id)
}

export function removeObject(id: number): void {
  getDb().prepare('DELETE FROM objects WHERE id = ?').run(id)
}

function getObjectById(id: number): OwnedObject {
  const row = getDb().prepare('SELECT * FROM objects WHERE id = ?').get(id) as ObjectRow
  return toOwnedObject(row)
}
