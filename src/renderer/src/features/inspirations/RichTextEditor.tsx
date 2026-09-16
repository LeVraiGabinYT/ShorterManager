import { useEffect, useRef, type ClipboardEvent, type ReactElement } from 'react'
import { TAG_COLOR_PRESETS } from '@shared/types'

interface RichTextEditorProps {
  html: string
  onChange: (html: string) => void
}

const FONT_SIZES = [
  { label: 'Normal', value: '' },
  { label: 'Grand', value: '1.3em' },
  { label: 'Très grand', value: '1.7em' }
]

// A hand-rolled selection-based formatter over a contentEditable div, rather than
// document.execCommand: execCommand's fontSize command only supports its legacy 1-7 scale (and
// inconsistently emits <font> tags), which isn't reliable enough for a "select text, click a
// button" formatting toolbar. Bold/italic/color/size are all applied the same way here — wrap the
// current selection in a styled <span> — so they behave identically instead of half going through
// execCommand and half not.
export function RichTextEditor({ html, onChange }: RichTextEditorProps): ReactElement {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalUpdate = useRef(false)

  // Only pushes external changes (switching to a different card) into the DOM — never echoes the
  // editor's own onChange back into itself, which would fight the browser's own cursor position.
  useEffect(() => {
    if (editorRef.current && !isInternalUpdate.current && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html
    }
    isInternalUpdate.current = false
  }, [html])

  function emitChange(): void {
    if (!editorRef.current) return
    isInternalUpdate.current = true
    onChange(editorRef.current.innerHTML)
  }

  function getSelectionRangeWithinEditor(): Range | null {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
    const range = selection.getRangeAt(0)
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return null
    return range
  }

  function applyStyle(style: Partial<CSSStyleDeclaration>): void {
    const range = getSelectionRangeWithinEditor()
    if (!range) return

    const span = document.createElement('span')
    Object.assign(span.style, style)
    span.appendChild(range.extractContents())
    range.insertNode(span)

    const selection = window.getSelection()
    selection?.removeAllRanges()
    const newRange = document.createRange()
    newRange.selectNodeContents(span)
    selection?.addRange(newRange)

    emitChange()
  }

  function clearFormatting(): void {
    const range = getSelectionRangeWithinEditor()
    if (!range) return
    const text = range.toString()
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    emitChange()
  }

  // Forces plain-text paste — pasting rich HTML from elsewhere would drag in arbitrary foreign
  // tags/styles this editor never produces itself, and the only place descriptionHtml is ever
  // interpreted as HTML again is back into this same contentEditable.
  function handlePaste(e: ClipboardEvent<HTMLDivElement>): void {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    emitChange()
  }

  return (
    <div className="overflow-hidden rounded-md border border-white/10">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-white/5 p-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyStyle({ fontWeight: 'bold' })}
          className="rounded px-2 py-1 text-xs font-bold text-gray-300 hover:bg-white/10"
          title="Gras"
        >
          G
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyStyle({ fontStyle: 'italic' })}
          className="rounded px-2 py-1 text-xs italic text-gray-300 hover:bg-white/10"
          title="Italique"
        >
          I
        </button>
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.value) applyStyle({ fontSize: e.target.value })
            e.target.value = ''
          }}
          defaultValue=""
          title="Taille du texte"
          className="rounded border border-white/10 bg-white/5 px-1 py-1 text-xs text-gray-300 outline-none"
        >
          <option value="" className="bg-[#15161a]">
            Taille...
          </option>
          {FONT_SIZES.filter((size) => size.value).map((size) => (
            <option key={size.value} value={size.value} className="bg-[#15161a]">
              {size.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 px-0.5">
          {TAG_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyStyle({ color })}
              style={{ backgroundColor: color }}
              className="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/20"
              title={color}
            />
          ))}
        </div>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearFormatting}
          className="ml-auto shrink-0 rounded px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-gray-200"
          title="Effacer la mise en forme de la sélection"
        >
          Effacer
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={emitChange}
        onPaste={handlePaste}
        suppressContentEditableWarning
        className="h-[120px] min-h-[80px] resize-y overflow-y-auto px-3 py-2 text-sm text-gray-100 outline-none [&_*]:max-w-full"
      />
    </div>
  )
}
