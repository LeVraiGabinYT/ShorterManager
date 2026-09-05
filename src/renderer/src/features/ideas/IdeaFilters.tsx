import { useState, type ReactElement } from 'react'
import { IDEA_STATUSES } from '@shared/types'
import type { IdeaStatus, OwnedObject, Series, Tag } from '@shared/types'
import { getTagChipStyle } from '../../lib/tagColors'
import {
  DEFAULT_IDEA_FILTERS,
  isFiltersActive,
  type DateFilter,
  type IdeaFiltersState
} from '../../lib/ideaFilters'

interface IdeaFiltersProps {
  filters: IdeaFiltersState
  onChange: (filters: IdeaFiltersState) => void
  tags: Tag[]
  objects: OwnedObject[]
  series: Series[]
}

function DateFilterEditor({
  label,
  value,
  onChange
}: {
  label: string
  value: DateFilter
  onChange: (value: DateFilter) => void
}): ReactElement {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-gray-400">{label}</label>
        <select
          value={value.mode}
          onChange={(e) => onChange({ ...value, mode: e.target.value as DateFilter['mode'] })}
          className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-gray-300 outline-none"
        >
          <option value="any" className="bg-[#15161a]">
            Peu importe
          </option>
          <option value="exact" className="bg-[#15161a]">
            Date précise
          </option>
          <option value="range" className="bg-[#15161a]">
            Plage
          </option>
        </select>
      </div>

      {value.mode === 'exact' && (
        <input
          type="date"
          value={value.exact}
          onChange={(e) => onChange({ ...value, exact: e.target.value })}
          className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
        />
      )}

      {value.mode === 'range' && (
        <div className="mt-1 flex items-center gap-1.5">
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
          />
          <span className="text-xs text-gray-600">→</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-blue-500/60 [color-scheme:dark]"
          />
        </div>
      )}
    </div>
  )
}

export function IdeaFilters({
  filters,
  onChange,
  tags,
  objects,
  series
}: IdeaFiltersProps): ReactElement {
  const [expanded, setExpanded] = useState(false)
  const active = isFiltersActive(filters)

  function toggleStatus(status: IdeaStatus): void {
    onChange({
      ...filters,
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status]
    })
  }

  function toggleTag(id: number): void {
    onChange({
      ...filters,
      tagIds: filters.tagIds.includes(id)
        ? filters.tagIds.filter((t) => t !== id)
        : [...filters.tagIds, id]
    })
  }

  function toggleObject(id: number): void {
    onChange({
      ...filters,
      objectIds: filters.objectIds.includes(id)
        ? filters.objectIds.filter((o) => o !== id)
        : [...filters.objectIds, id]
    })
  }

  function toggleSeries(id: number): void {
    onChange({
      ...filters,
      seriesIds: filters.seriesIds.includes(id)
        ? filters.seriesIds.filter((s) => s !== id)
        : [...filters.seriesIds, id]
    })
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="flex items-center gap-2 p-3">
        <input
          value={filters.keyword}
          onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          placeholder="Rechercher un mot-clé (titre, description)..."
          className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            active
              ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
              : 'border-white/10 text-gray-400 hover:text-gray-200'
          }`}
        >
          Filtres{active ? ' •' : ''}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_IDEA_FILTERS)}
            className="text-sm text-gray-500 hover:text-gray-300"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-1 gap-6 border-t border-white/10 p-3 sm:grid-cols-2">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-400 mb-1">Tags</label>
                {filters.tagIds.length > 1 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <button
                      type="button"
                      onClick={() => onChange({ ...filters, tagMode: 'any' })}
                      className={filters.tagMode === 'any' ? 'text-blue-300' : ''}
                    >
                      Au moins un
                    </button>
                    <span>/</span>
                    <button
                      type="button"
                      onClick={() => onChange({ ...filters, tagMode: 'all' })}
                      className={filters.tagMode === 'all' ? 'text-blue-300' : ''}
                    >
                      Tous
                    </button>
                  </div>
                )}
              </div>
              {tags.length === 0 ? (
                <p className="text-xs text-gray-600">Aucun tag créé pour l’instant.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const selected = filters.tagIds.includes(tag.id)
                    return (
                      <button
                        type="button"
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        style={selected ? getTagChipStyle(tag.color) : undefined}
                        className={`rounded-md border px-2 py-1 text-xs ${
                          selected
                            ? ''
                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Objets</label>
              {objects.length === 0 ? (
                <p className="text-xs text-gray-600">Aucun objet enregistré pour l’instant.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {objects.map((obj) => (
                    <button
                      type="button"
                      key={obj.id}
                      onClick={() => toggleObject(obj.id)}
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        filters.objectIds.includes(obj.id)
                          ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {obj.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Série</label>
              {series.length === 0 ? (
                <p className="text-xs text-gray-600">Aucune série créée pour l’instant.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {series.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleSeries(s.id)}
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        filters.seriesIds.includes(s.id)
                          ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <DateFilterEditor
              label="Date de tournage"
              value={filters.shootDate}
              onChange={(v) => onChange({ ...filters, shootDate: v })}
            />
            <DateFilterEditor
              label="Date de publication"
              value={filters.publishDate}
              onChange={(v) => onChange({ ...filters, publishDate: v })}
            />

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Statut</label>
              <div className="flex flex-wrap gap-1.5">
                {IDEA_STATUSES.map((s) => (
                  <button
                    type="button"
                    key={s.value}
                    onClick={() => toggleStatus(s.value)}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      filters.statuses.includes(s.value)
                        ? 'border-blue-500/60 bg-blue-500/20 text-blue-200'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
