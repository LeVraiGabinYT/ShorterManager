import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactElement
} from 'react'
import { TAG_COLOR_PRESETS } from '@shared/types'

interface ScriptEditorProps {
  html: string
  onChange: (html: string) => void
}

const HEADING_TAGS = ['h1', 'h2', 'h3'] as const
type HeadingTag = (typeof HEADING_TAGS)[number]

const SIZE_OPTIONS: { label: string; tag: HeadingTag | 'p' }[] = [
  { label: 'Normal', tag: 'p' },
  { label: '### Titre 3', tag: 'h3' },
  { label: '## Titre 2', tag: 'h2' },
  { label: '# Titre 1', tag: 'h1' }
]

// A full-featured script editor, deliberately built the same way as Inspirations'
// RichTextEditor (hand-rolled selection-based formatting over a contentEditable div, not
// document.execCommand's unreliable legacy fontSize scale) but extended with underline, a
// heading/size dropdown, and a markdown-style shortcut: typing "# ", "## " or "### " at the very
// start of a line converts that line into a heading, mirroring how Markdown itself controls text
// size — the one thing explicitly asked for on top of the usual bold/italic/underline/color set.
export function ScriptEditor({ html, onChange }: ScriptEditorProps): ReactElement {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalUpdate = useRef(false)

  // Only pushes external changes (switching to a different idea) into the DOM — never echoes the
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

  // Converts the block the caret is currently in — via execCommand('formatBlock'), the one
  // execCommand still reliable across Chromium for this — used by both the "Taille" dropdown and
  // the "# " markdown shortcut below, so typing a shortcut and picking the same size from the
  // toolbar always produce an identical result.
  function applyBlockTag(tag: HeadingTag | 'p'): void {
    editorRef.current?.focus()
    document.execCommand('formatBlock', false, tag)
    emitChange()
  }

  // Notion/Markdown-style shortcut: as soon as "# ", "## " or "### " is the entire text of the
  // current line, it's stripped and the line becomes a heading — checked via Selection.modify
  // (extend the caret back to the start of the line) rather than walking the DOM, so it works
  // whether or not the line happens to be wrapped in its own block element yet.
  function maybeApplyHeadingShortcut(): void {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return
    if (!editorRef.current || !editorRef.current.contains(selection.anchorNode)) return

    const caretRange = selection.getRangeAt(0).cloneRange()
    selection.modify('extend', 'backward', 'lineboundary')
    const linePrefix = selection.toString()
    const match = linePrefix.match(/^(#{1,3}) $/)

    if (!match) {
      selection.removeAllRanges()
      selection.addRange(caretRange)
      return
    }

    document.execCommand('delete')
    const tag = HEADING_TAGS[match[1].length - 1]
    applyBlockTag(tag)
  }

  function handleInput(): void {
    maybeApplyHeadingShortcut()
    emitChange()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (!(e.ctrlKey || e.metaKey)) return
    if (e.key === 'b') {
      e.preventDefault()
      applyStyle({ fontWeight: 'bold' })
    } else if (e.key === 'i') {
      e.preventDefault()
      applyStyle({ fontStyle: 'italic' })
    } else if (e.key === 'u') {
      e.preventDefault()
      applyStyle({ textDecoration: 'underline' })
    }
  }

  // Forces plain-text paste — pasting rich HTML from elsewhere would drag in arbitrary foreign
  // tags/styles this editor never produces itself, and the only place `html` is ever interpreted
  // as HTML again is back into this same contentEditable.
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
          title="Gras (Ctrl+B)"
        >
          G
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyStyle({ fontStyle: 'italic' })}
          className="rounded px-2 py-1 text-xs italic text-gray-300 hover:bg-white/10"
          title="Italique (Ctrl+I)"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyStyle({ textDecoration: 'underline' })}
          className="rounded px-2 py-1 text-xs text-gray-300 underline hover:bg-white/10"
          title="Souligné (Ctrl+U)"
        >
          U
        </button>
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const option = SIZE_OPTIONS.find((o) => o.label === e.target.value)
            if (option) applyBlockTag(option.tag)
            e.target.value = ''
          }}
          defaultValue=""
          title="Taille du texte — comme en Markdown, '#', '##' ou '###' en début de ligne fait pareil"
          className="rounded border border-white/10 bg-white/5 px-1 py-1 text-xs text-gray-300 outline-none"
        >
          <option value="" className="bg-[#15161a]">
            Taille...
          </option>
          {SIZE_OPTIONS.map((option) => (
            <option key={option.label} value={option.label} className="bg-[#15161a]">
              {option.label}
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
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        suppressContentEditableWarning
        className="h-[280px] min-h-[160px] resize-y overflow-y-auto px-3 py-2 text-sm text-gray-100 outline-none [&_*]:max-w-full [&_h1]:my-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-1.5 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:my-1 [&_h3]:text-lg [&_h3]:font-bold"
      />
    </div>
  )
}
