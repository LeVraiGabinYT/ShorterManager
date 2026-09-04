import { useMemo, useState, type ReactElement } from 'react'

interface SearchablePickerProps<T> {
  items: T[]
  getLabel: (item: T) => string
  getKey: (item: T) => string | number
  onSelect: (item: T) => void
  placeholder: string
  emptyLabel: string
}

export function SearchablePicker<T>({
  items,
  getLabel,
  getKey,
  onSelect,
  placeholder,
  emptyLabel
}: SearchablePickerProps<T>): ReactElement {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => getLabel(item).toLowerCase().includes(q))
  }, [items, query, getLabel])

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={items.length === 0}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500/60 disabled:opacity-50"
      />
      {items.length === 0 && <p className="mt-1 text-xs text-gray-600">{emptyLabel}</p>}

      {open && items.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-white/10 bg-[#1c1d22] shadow-xl">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">Aucun résultat.</p>
          ) : (
            filtered.map((item) => (
              <button
                type="button"
                key={getKey(item)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(item)
                  setQuery('')
                  setOpen(false)
                }}
                className="block w-full truncate px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-white/10"
              >
                {getLabel(item)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
