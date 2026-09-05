import { getDb } from './index'
import type { Series } from '../../shared/types'

interface SeriesRow {
  id: number
  name: string
  created_at: string
}

function toSeries(row: SeriesRow): Series {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at
  }
}

export function listSeries(): Series[] {
  const rows = getDb().prepare('SELECT * FROM series ORDER BY name ASC').all() as SeriesRow[]
  return rows.map(toSeries)
}

export function createSeries(name: string): Series {
  const result = getDb().prepare('INSERT INTO series (name) VALUES (?)').run(name)
  return getSeriesById(result.lastInsertRowid as number)
}

export function renameSeries(id: number, name: string): Series {
  getDb().prepare('UPDATE series SET name = ? WHERE id = ?').run(name, id)
  return getSeriesById(id)
}

export function removeSeries(id: number): void {
  getDb().prepare('DELETE FROM series WHERE id = ?').run(id)
}

function getSeriesById(id: number): Series {
  const row = getDb().prepare('SELECT * FROM series WHERE id = ?').get(id) as SeriesRow
  return toSeries(row)
}
