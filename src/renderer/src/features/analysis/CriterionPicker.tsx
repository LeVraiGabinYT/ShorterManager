import type { ReactElement } from 'react'
import type { OwnedObject, Series, Tag } from '@shared/types'
import type { Criterion, CriterionType } from '../../lib/analysisFilters'

interface CriterionPickerProps {
  label: string
  tags: Tag[]
  objects: OwnedObject[]
  series: Series[]
  value: Criterion
  onChange: (value: Criterion) => void
}

const TYPE_LABELS: Record<CriterionType, string> = {
  tag: 'Tag',
  object: 'Objet',
  series: 'Série',
  keyword: 'Mot-clé'
}

const PICK_PLACEHOLDER: Record<Exclude<CriterionType, 'keyword'>, string> = {
  tag: 'Choisir un tag...',
  object: 'Choisir un objet...',
  series: 'Choisir une série...'
}

export function CriterionPicker({
  label,
  tags,
  objects,
  series,
  value,
  onChange
}: CriterionPickerProps): ReactElement {
  function setType(type: CriterionType): void {
    onChange({ type, value: '' })
  }

  const optionsByType: Record<Exclude<CriterionType, 'keyword'>, { id: number; name: string }[]> = {
    tag: tags,
    object: objects,
    series: series
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-400">{label}</label>
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-md border border-white/10 bg-white/5 p-0.5">
          {(Object.keys(TYPE_LABELS) as CriterionType[]).map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => setType(type)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                value.type === type
                  ? 'bg-blue-500/20 text-blue-200'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {value.type === 'keyword' ? (
          <input
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            placeholder="Mot-clé dans le titre ou la description..."
            className="min-w-[12rem] flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
          />
        ) : (
          <select
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            className="min-w-[12rem] flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
          >
            <option value="" className="bg-[#15161a]">
              {PICK_PLACEHOLDER[value.type]}
            </option>
            {optionsByType[value.type].map((item) => (
              <option key={item.id} value={item.id} className="bg-[#15161a]">
                {item.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
