import { useState, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react'
import type { InspirationGroup } from '@shared/types'
import { TAG_COLOR_PRESETS } from '@shared/types'

interface InspirationGroupFrameProps {
  group: InspirationGroup
  x: number
  y: number
  width: number
  height: number
  selected: boolean
  onHeaderMouseDown: (e: ReactMouseEvent) => void
  onResizeMouseDown: (e: ReactMouseEvent) => void
  onRename: (title: string) => void
  onRecolor: (color: string) => void
  onDelete: () => void
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const value = parseInt(clean, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// A purely geometric colored rectangle ("encadré") drawn behind cards to visually cluster them —
// no membership list, a card is "in" a group simply by sitting inside its bounds. The body is
// pointer-events-none so clicks/drags pass through to whatever card is underneath; only the
// header (move) and the corner handle (resize) are interactive.
export function InspirationGroupFrame({
  group,
  x,
  y,
  width,
  height,
  selected,
  onHeaderMouseDown,
  onResizeMouseDown,
  onRename,
  onRecolor,
  onDelete
}: InspirationGroupFrameProps): ReactElement {
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  return (
    <div
      style={{
        left: x,
        top: y,
        width,
        height,
        borderColor: hexToRgba(group.color, selected ? 0.95 : 0.55),
        backgroundColor: hexToRgba(group.color, selected ? 0.12 : 0.06),
        boxShadow: selected ? `0 0 0 2px ${hexToRgba(group.color, 0.35)}` : undefined
      }}
      className="pointer-events-none absolute rounded-lg border-2"
    >
      {/* Spans the full frame width (not just its content) so there's a large, obvious strip to
          grab — including right over the title input: its mousedown deliberately does NOT stop
          propagation, so starting a drag there still moves the group. A plain click (no movement
          in between) still ends up focusing the input as normal, since nothing here calls
          preventDefault — only an actual drag gesture (handled entirely in the parent, based on
          mouse movement) is distinguished from a click. Only the color swatch and delete button
          opt out via their own stopPropagation, since those must always act on a single click. */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{ backgroundColor: hexToRgba(group.color, 0.3), width }}
        className="pointer-events-auto absolute -top-10 left-0 flex h-10 cursor-move items-center gap-2 rounded-t-md px-3"
      >
        <div className="relative shrink-0">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setColorPickerOpen((v) => !v)}
            style={{ backgroundColor: group.color }}
            className="h-5 w-5 shrink-0 rounded-full ring-1 ring-white/30"
            title="Couleur"
          />
          {colorPickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setColorPickerOpen(false)} />
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute left-0 top-full z-20 mt-1 flex items-center gap-1 rounded-md border border-white/10 bg-[#1c1d22] p-1.5 shadow-xl"
              >
                {TAG_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onRecolor(color)
                      setColorPickerOpen(false)
                    }}
                    style={{ backgroundColor: color }}
                    className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/20"
                    title={color}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <input
          value={group.title}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Groupe"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-gray-100 outline-none placeholder:text-gray-400"
        />
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          title="Supprimer le groupe"
          className="shrink-0 rounded p-1 text-gray-300 hover:bg-black/20 hover:text-red-300"
        >
          ✕
        </button>
      </div>

      <div
        onMouseDown={onResizeMouseDown}
        title="Redimensionner"
        className="pointer-events-auto absolute -bottom-2.5 -right-2.5 flex h-6 w-6 cursor-nwse-resize items-center justify-center"
      >
        <div
          className="h-3.5 w-3.5 rounded-full border-2 border-[#0b0c0f]"
          style={{ backgroundColor: group.color }}
        />
      </div>
    </div>
  )
}
