import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement
} from 'react'
import type { Inspiration } from '@shared/types'
import type { LinkedIdeaSummary } from './InspirationsTab'

interface InspirationNodeProps {
  inspiration: Inspiration
  x: number
  y: number
  selected: boolean
  multiSelected: boolean
  linking: boolean
  // 'idea' kind only, resolved live in the parent from the same ideas/publishedVideos data every
  // other tab reads — null when unlinked.
  linkedIdeaSummary: LinkedIdeaSummary | null
  onMouseDown: (e: ReactMouseEvent) => void
  onLinkHandleMouseDown: (e: ReactMouseEvent) => void
  registerElement: (el: HTMLDivElement | null) => void
}

const CARD_HORIZONTAL_PADDING = 24 // p-3 on both sides
const MIN_IDEA_WIDTH = 144 // 9rem
const MIN_VIDEO_WIDTH = 256 // 16rem
const DEFAULT_TITLE_FONT_SIZE = 14 // matches the old fixed text-sm

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const value = parseInt(clean, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatStat(value: number | null): string {
  if (value === null) return '–'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

// Purely presentational — all drag/link mechanics (position tracking, window-level mouse
// listeners, hit-testing) live in InspirationsTab so a single mouse gesture can move a node AND
// keep any connection lines attached to it in sync, and so creating a link (drag from the handle
// onto another node) can hit-test across every node from one place.
export function InspirationNode({
  inspiration,
  x,
  y,
  selected,
  multiSelected,
  linking,
  linkedIdeaSummary,
  onMouseDown,
  onLinkHandleMouseDown,
  registerElement
}: InspirationNodeProps): ReactElement {
  const titleRowRef = useRef<HTMLDivElement | null>(null)
  // The card's width is driven ONLY by the title row's own natural (unwrapped) width, measured
  // here — never by `width: fit-content` on the card itself. A fit-content card with a
  // percentage-width <img> child (the thumbnail below) hits a well-known CSS trap: since a
  // percentage width can't be resolved until the container's own width is known, the browser
  // falls back to the image's raw intrinsic pixel size (its actual downloaded resolution, e.g.
  // ~480px) to compute the fit-content container's width — so the card would silently snap to
  // whatever size the thumbnail happens to be. Measuring the title instead and applying it as an
  // explicit pixel width sidesteps that entirely: the image's 100%-width thumbnail then resolves
  // against an already-fixed, definite container width, with no intrinsic-size fallback possible.
  // It also naturally re-measures whenever the title's own font-size changes (see fontSize below),
  // so a bigger "Titre" card grows to fit exactly like a longer title does.
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = titleRowRef.current
    if (!el) return
    const minWidth = inspiration.kind === 'youtube_video' ? MIN_VIDEO_WIDTH : MIN_IDEA_WIDTH

    function measure(): void {
      if (!el) return
      // scrollWidth, not getBoundingClientRect().width: the canvas applies a CSS
      // `transform: scale(zoom)` to everything (see InspirationsTab), and getBoundingClientRect()
      // reports the POST-transform (on-screen) size — at any zoom other than 100% that's the
      // wrong number entirely, and used to size this card made the title overflow it. scrollWidth
      // always reports the element's own untransformed layout width regardless of ancestor zoom.
      // The +2px buffer covers scrollWidth's integer rounding at large custom font sizes, which
      // would otherwise undercount by a pixel or two and crowd the right edge.
      setMeasuredWidth(Math.max(minWidth, el.scrollWidth + 2 + CARD_HORIZONTAL_PADDING))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [inspiration.title, inspiration.emoji, inspiration.kind, inspiration.fontSize])

  const isLabelKind = inspiration.kind === 'title' || inspiration.kind === 'text'

  return (
    <div
      ref={registerElement}
      data-inspiration-id={inspiration.id}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      style={{
        left: x,
        top: y,
        width: measuredWidth ?? undefined,
        backgroundColor:
          isLabelKind && inspiration.backgroundColor
            ? hexToRgba(inspiration.backgroundColor, 0.22)
            : undefined
      }}
      className={`absolute cursor-grab select-none rounded-lg border p-3 shadow-lg active:cursor-grabbing ${
        // Tailwind needs a literal class string to generate the utility at build time (a template-
        // interpolated `w-[${var}px]` would silently produce no CSS), so these two exact values
        // are spelled out rather than built from the MIN_*_WIDTH constants above.
        measuredWidth === null
          ? inspiration.kind === 'youtube_video'
            ? 'w-[256px]'
            : 'w-[144px]'
          : ''
      } ${
        selected
          ? 'border-blue-500 bg-[#1c1d22] shadow-blue-500/20'
          : multiSelected
            ? 'border-amber-400/80 bg-[#1c1d22] shadow-amber-400/10'
            : linking
              ? 'border-blue-400/60 bg-[#15161a]'
              : isLabelKind && inspiration.backgroundColor
                ? 'border-white/10'
                : 'border-white/10 bg-[#15161a] hover:border-white/20'
      }`}
    >
      <div
        ref={titleRowRef}
        className="flex w-fit items-center gap-2"
        style={{ fontSize: (isLabelKind && inspiration.fontSize) || DEFAULT_TITLE_FONT_SIZE }}
      >
        {inspiration.emoji && (
          <span className="shrink-0 text-[1.4em] leading-none">{inspiration.emoji}</span>
        )}
        <span
          className={`min-w-0 whitespace-nowrap font-medium ${
            isLabelKind && inspiration.fontColor ? '' : 'text-gray-100'
          }`}
          style={{
            color: isLabelKind && inspiration.fontColor ? inspiration.fontColor : undefined
          }}
        >
          {inspiration.title}
        </span>
      </div>

      {inspiration.kind === 'text' && inspiration.descriptionHtml && (
        <div
          className={`mt-1.5 max-w-xs text-xs [&_*]:max-w-full ${
            inspiration.fontColor ? '' : 'text-gray-100'
          }`}
          style={{ color: inspiration.fontColor ? inspiration.fontColor : undefined }}
          dangerouslySetInnerHTML={{ __html: inspiration.descriptionHtml }}
        />
      )}

      {inspiration.kind === 'youtube_video' && inspiration.videoThumbnailUrl && (
        <img
          src={inspiration.videoThumbnailUrl}
          alt=""
          draggable={false}
          className="mt-2 aspect-video w-full rounded-md object-cover"
        />
      )}

      {inspiration.kind === 'idea' && linkedIdeaSummary && (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-500">
          <span>👁️ {formatStat(linkedIdeaSummary.viewCount)}</span>
          <span>👍 {formatStat(linkedIdeaSummary.likeCount)}</span>
          <span>💬 {formatStat(linkedIdeaSummary.commentCount)}</span>
        </div>
      )}

      {(inspiration.videos.length > 0 ||
        inspiration.objects.length > 0 ||
        inspiration.details.length > 0) && (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-500">
          {inspiration.videos.length > 0 && <span>🎬 {inspiration.videos.length}</span>}
          {inspiration.objects.length > 0 && <span>📦 {inspiration.objects.length}</span>}
          {inspiration.details.length > 0 && <span>📝 {inspiration.details.length}</span>}
        </div>
      )}

      <div
        onMouseDown={onLinkHandleMouseDown}
        onClick={(e) => e.stopPropagation()}
        title="Glisser pour relier à une autre carte"
        className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-crosshair rounded-full border-2 border-[#0b0c0f] bg-blue-500 hover:bg-blue-400"
      />
    </div>
  )
}
