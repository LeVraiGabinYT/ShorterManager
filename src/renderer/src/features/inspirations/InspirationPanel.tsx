import { useEffect, useRef, useState, type ReactElement } from 'react'
import type {
  Inspiration,
  InspirationDetailInput,
  InspirationDetailType,
  InspirationInput,
  InspirationObjectInput,
  InspirationVideoInput,
  VideoIdea
} from '@shared/types'
import { TAG_COLOR_PRESETS } from '@shared/types'
import { SearchablePicker } from '../../components/SearchablePicker'
import { RichTextEditor } from './RichTextEditor'
import type { LinkedIdeaSummary } from './InspirationsTab'

const DETAIL_TYPE_LABELS: Record<InspirationDetailType, string> = {
  text: 'Texte',
  number: 'Nombre',
  textarea: 'Zone de texte'
}

// 'title'/'text' node title font size, in px — null (the "Normal" preset) matches every other
// card's fixed default size.
const FONT_SIZE_PRESETS: { label: string; value: number | null }[] = [
  { label: 'Normal', value: null },
  { label: 'Grand', value: 22 },
  { label: 'Très grand', value: 32 },
  { label: 'Énorme', value: 48 }
]

// Mirrors extractYouTubeVideoId() in main/youtube/oembed.ts — duplicated rather than shared
// because that one runs in the main process (used to resolve a link's title/thumbnail via
// oEmbed); this one only ever needs the id itself, to build an embed URL for the in-panel player.
function extractYouTubeVideoId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = parsed.hostname.replace(/^www\.|^m\./, '')

  if (host === 'youtu.be') {
    return parsed.pathname.slice(1).split('/')[0] || null
  }
  if (host === 'youtube.com') {
    if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || null
    if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || null
    if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
  }
  return null
}

// How long to wait, after the last edit, before persisting to the DB — long enough that a burst
// of keystrokes only triggers one write, short enough that a card is basically always saved.
const COMMIT_DEBOUNCE_MS = 600

interface InspirationPanelProps {
  inspiration: Inspiration
  width: number
  ideas: VideoIdea[]
  linkedIdeaSummary: LinkedIdeaSummary | null
  // Fired on every edit, purely so the card on the canvas stays visually in sync while typing —
  // never persisted by itself.
  onLiveChange: (
    patch: Partial<
      Pick<
        Inspiration,
        | 'title'
        | 'emoji'
        | 'videoUrl'
        | 'videoThumbnailUrl'
        | 'backgroundColor'
        | 'fontColor'
        | 'fontSize'
        | 'linkedIdeaId'
      >
    >
  ) => void
  // The actual DB write — debounced while typing, and always flushed immediately on blur (moving
  // to another field) or when this panel unmounts (closing/deselecting the card). There is no
  // explicit "Enregistrer" button by design: edits apply live and save themselves.
  onCommit: (input: InspirationInput) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  onNavigateToIdea: (ideaId: number) => void
}

// Remounted (via `key={inspiration.id}` at the call site) every time the selected card changes —
// so its local draft state always starts fresh from the newly-selected card instead of carrying
// over the previous one's unsaved edits.
export function InspirationPanel({
  inspiration,
  width,
  ideas,
  linkedIdeaSummary,
  onLiveChange,
  onCommit,
  onDelete,
  onClose,
  onNavigateToIdea
}: InspirationPanelProps): ReactElement {
  const [title, setTitle] = useState(inspiration.title)
  const [emoji, setEmoji] = useState(inspiration.emoji ?? '')
  const [descriptionHtml, setDescriptionHtml] = useState(inspiration.descriptionHtml)
  const [videoUrlDraft, setVideoUrlDraft] = useState(inspiration.videoUrl ?? '')
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState(inspiration.videoThumbnailUrl)
  const [videoLinkChecking, setVideoLinkChecking] = useState(false)
  const [videoLinkError, setVideoLinkError] = useState<string | null>(null)
  const [backgroundColor, setBackgroundColor] = useState(inspiration.backgroundColor)
  const [fontColor, setFontColor] = useState(inspiration.fontColor)
  const [fontSize, setFontSize] = useState(inspiration.fontSize)
  const [linkedIdeaId, setLinkedIdeaId] = useState(inspiration.linkedIdeaId)
  const [videos, setVideos] = useState<InspirationVideoInput[]>(
    inspiration.videos.map((v) => ({ url: v.url, label: v.label }))
  )
  const [objects, setObjects] = useState<InspirationObjectInput[]>(
    inspiration.objects.map((o) => ({ name: o.name, link: o.link }))
  )
  const [details, setDetails] = useState<InspirationDetailInput[]>(
    inspiration.details.map((d) => ({ name: d.name, type: d.type, value: d.value }))
  )
  const [newDetailType, setNewDetailType] = useState<InspirationDetailType>('text')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const dirtyRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Always re-pointed to a fresh closure every render (no deps array) so the effect-cleanup below
  // — which only ever runs the LAST closure it was given — commits the latest draft, not whatever
  // state existed when the component first mounted.
  const commitNowRef = useRef<() => void>(() => {})

  useEffect(() => {
    commitNowRef.current = () => {
      if (!dirtyRef.current) return
      dirtyRef.current = false
      void onCommit({
        boardId: inspiration.boardId,
        kind: inspiration.kind,
        title: title.trim() || 'Sans titre',
        emoji: emoji.trim() || null,
        descriptionHtml,
        videoUrl: videoUrlDraft.trim() || null,
        videoThumbnailUrl,
        backgroundColor,
        fontColor,
        fontSize,
        linkedIdeaId,
        posX: inspiration.posX,
        posY: inspiration.posY,
        videos: videos.filter((v) => v.url.trim() !== ''),
        objects: objects.filter((o) => o.name.trim() !== ''),
        details: details.filter((d) => d.name.trim() !== '')
      })
    }
  })

  // Flushes any unsaved edit when the card is deselected or the panel is closed (both unmount
  // this component, since it's only ever rendered behind `selected &&` at the call site).
  useEffect(() => {
    return () => commitNowRef.current()
  }, [])

  function scheduleCommit(): void {
    dirtyRef.current = true
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => commitNowRef.current(), COMMIT_DEBOUNCE_MS)
  }

  // Bound to the whole field area via onBlur, which React bubbles like focusout — so leaving any
  // single input for any reason (finished typing, clicking another field, deselecting the card)
  // flushes immediately instead of waiting out the debounce.
  function handleAreaBlur(): void {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    commitNowRef.current()
  }

  function handleTitleChange(value: string): void {
    setTitle(value)
    onLiveChange({ title: value })
    scheduleCommit()
  }

  function handleEmojiChange(value: string): void {
    setEmoji(value)
    onLiveChange({ emoji: value.trim() || null })
    scheduleCommit()
  }

  function handleDescriptionChange(html: string): void {
    setDescriptionHtml(html)
    scheduleCommit()
  }

  function handleBackgroundColorChange(color: string | null): void {
    setBackgroundColor(color)
    onLiveChange({ backgroundColor: color })
    scheduleCommit()
  }

  function handleFontColorChange(color: string | null): void {
    setFontColor(color)
    onLiveChange({ fontColor: color })
    scheduleCommit()
  }

  function handleFontSizeChange(size: number | null): void {
    setFontSize(size)
    onLiveChange({ fontSize: size })
    scheduleCommit()
  }

  function handleLinkIdea(idea: VideoIdea | null): void {
    setLinkedIdeaId(idea?.id ?? null)
    onLiveChange({ linkedIdeaId: idea?.id ?? null })
    scheduleCommit()
  }

  async function handleVideoLinkBlur(): Promise<void> {
    const trimmed = videoUrlDraft.trim()
    if (trimmed === (inspiration.videoUrl ?? '') && !videoLinkError) return

    if (!trimmed) {
      setVideoThumbnailUrl(null)
      setVideoLinkError(null)
      onLiveChange({ videoUrl: null, videoThumbnailUrl: null })
      scheduleCommit()
      return
    }

    setVideoLinkChecking(true)
    setVideoLinkError(null)
    const meta = await window.api.inspirations.fetchYoutubeMeta(trimmed)
    setVideoLinkChecking(false)

    if (!meta) {
      setVideoLinkError('Lien YouTube invalide ou vidéo introuvable.')
      return
    }

    setVideoThumbnailUrl(meta.thumbnailUrl)
    setTitle(meta.title)
    onLiveChange({ videoUrl: trimmed, videoThumbnailUrl: meta.thumbnailUrl, title: meta.title })
    scheduleCommit()
  }

  function addVideo(): void {
    setVideos((prev) => [...prev, { url: '', label: null }])
    scheduleCommit()
  }
  function updateVideo(index: number, patch: Partial<InspirationVideoInput>): void {
    setVideos((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)))
    scheduleCommit()
  }
  function removeVideo(index: number): void {
    setVideos((prev) => prev.filter((_, i) => i !== index))
    scheduleCommit()
  }

  function addObject(): void {
    setObjects((prev) => [...prev, { name: '', link: null }])
    scheduleCommit()
  }
  function updateObject(index: number, patch: Partial<InspirationObjectInput>): void {
    setObjects((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
    scheduleCommit()
  }
  function removeObject(index: number): void {
    setObjects((prev) => prev.filter((_, i) => i !== index))
    scheduleCommit()
  }

  function addDetail(): void {
    setDetails((prev) => [...prev, { name: '', type: newDetailType, value: '' }])
    scheduleCommit()
  }
  function updateDetail(index: number, patch: Partial<InspirationDetailInput>): void {
    setDetails((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
    scheduleCommit()
  }
  function removeDetail(index: number): void {
    setDetails((prev) => prev.filter((_, i) => i !== index))
    scheduleCommit()
  }

  async function handleDeleteClick(): Promise<void> {
    // The card is about to be gone — don't let the panel's unmount flush a commit against an id
    // that no longer exists in the DB.
    dirtyRef.current = false
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    await onDelete()
  }

  const isLabelKind = inspiration.kind === 'title' || inspiration.kind === 'text'

  return (
    <div
      style={{ width }}
      className="flex shrink-0 flex-col border-l border-white/10 bg-[#111217]"
      onBlur={handleAreaBlur}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-100">Détails</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex gap-2">
          <input
            value={emoji}
            onChange={(e) => handleEmojiChange(e.target.value)}
            placeholder={inspiration.kind === 'youtube_video' ? '🎥' : isLabelKind ? '🔤' : '💡'}
            maxLength={4}
            className="w-14 shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-center text-lg text-gray-100 outline-none focus:border-blue-500/60"
          />
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Titre"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
          />
        </div>

        {isLabelKind && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Taille</label>
            <div className="flex flex-wrap items-center gap-1.5">
              {FONT_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleFontSizeChange(preset.value)}
                  title={preset.label}
                  className={`rounded-md border px-2.5 py-1 font-medium text-gray-100 ${
                    fontSize === preset.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                  style={{ fontSize: Math.min(preset.value ?? 14, 20) }}
                >
                  A
                </button>
              ))}
            </div>
          </div>
        )}

        {isLabelKind && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Couleur de fond
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBackgroundColorChange(null)}
                  title="Par défaut"
                  className={`h-5 w-5 shrink-0 rounded-full border border-dashed border-gray-500 ${
                    !backgroundColor ? 'ring-2 ring-blue-500' : ''
                  }`}
                />
                {TAG_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleBackgroundColorChange(color)}
                    style={{ backgroundColor: color }}
                    title={color}
                    className={`h-5 w-5 shrink-0 rounded-full ring-1 ring-white/20 ${
                      backgroundColor === color ? 'ring-2 ring-blue-400' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Couleur du texte
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFontColorChange(null)}
                  title="Par défaut"
                  className={`h-5 w-5 shrink-0 rounded-full border border-dashed border-gray-500 ${
                    !fontColor ? 'ring-2 ring-blue-500' : ''
                  }`}
                />
                {TAG_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleFontColorChange(color)}
                    style={{ backgroundColor: color }}
                    title={color}
                    className={`h-5 w-5 shrink-0 rounded-full ring-1 ring-white/20 ${
                      fontColor === color ? 'ring-2 ring-blue-400' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {inspiration.kind === 'idea' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Idée liée du tableau de bord
            </label>
            {linkedIdeaSummary ? (
              <div
                className="space-y-2 rounded-md border p-2.5"
                style={{
                  borderColor: `${linkedIdeaSummary.statusColor}80`,
                  backgroundColor: `${linkedIdeaSummary.statusColor}1a`
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs font-medium text-gray-100">
                    {linkedIdeaSummary.title}
                  </span>
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: linkedIdeaSummary.statusColor }}
                  >
                    {linkedIdeaSummary.statusLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span>👁️ {linkedIdeaSummary.viewCount ?? '–'}</span>
                  <span>👍 {linkedIdeaSummary.likeCount ?? '–'}</span>
                  <span>💬 {linkedIdeaSummary.commentCount ?? '–'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateToIdea(linkedIdeaSummary.ideaId)}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300"
                  >
                    Accéder à l’idée →
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLinkIdea(null)}
                    className="text-xs text-gray-500 hover:text-red-300"
                  >
                    Délier
                  </button>
                </div>
              </div>
            ) : (
              <SearchablePicker
                items={ideas}
                getLabel={(idea) => idea.title}
                getKey={(idea) => idea.id}
                onSelect={handleLinkIdea}
                placeholder="Rechercher une idée à lier..."
                emptyLabel="Aucune idée dans le tableau de bord."
              />
            )}
          </div>
        )}

        {inspiration.kind === 'youtube_video' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Lien du Short / de la vidéo
            </label>
            <input
              value={videoUrlDraft}
              onChange={(e) => setVideoUrlDraft(e.target.value)}
              onBlur={handleVideoLinkBlur}
              placeholder="https://www.youtube.com/shorts/..."
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-100 outline-none focus:border-blue-500/60"
            />
            {videoLinkChecking && (
              <p className="mt-1 text-xs text-gray-500">Vérification du lien...</p>
            )}
            {videoLinkError && <p className="mt-1 text-xs text-red-400">{videoLinkError}</p>}
            {(() => {
              const videoId =
                extractYouTubeVideoId(videoUrlDraft) ??
                extractYouTubeVideoId(inspiration.videoUrl ?? '')
              if (videoId) {
                return (
                  <div className="mt-2 aspect-video w-full overflow-hidden rounded-md bg-black">
                    <iframe
                      key={videoId}
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title={title || 'Lecteur vidéo'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                )
              }
              if (videoThumbnailUrl) {
                return (
                  <img
                    src={videoThumbnailUrl}
                    alt=""
                    className="mt-2 aspect-video w-full rounded-md object-cover"
                  />
                )
              }
              return null
            })()}
          </div>
        )}

        {inspiration.kind !== 'title' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">
              {inspiration.kind === 'text' ? 'Texte' : 'Description'}
            </label>
            <RichTextEditor html={descriptionHtml} onChange={handleDescriptionChange} />
          </div>
        )}

        {!isLabelKind && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">Vidéos d’inspiration</label>
              <button
                type="button"
                onClick={addVideo}
                className="text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                + Ajouter 1
              </button>
            </div>
            <div className="space-y-1.5">
              {videos.length === 0 && (
                <p className="text-xs text-gray-600">Aucune vidéo pour l’instant.</p>
              )}
              {videos.map((video, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <input
                    value={video.url}
                    onChange={(e) => updateVideo(index, { url: e.target.value })}
                    placeholder="Lien de la vidéo"
                    className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => removeVideo(index)}
                    title="Retirer"
                    className="shrink-0 text-gray-500 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLabelKind && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400">
                Objets (indépendants du tableau de bord)
              </label>
              <button
                type="button"
                onClick={addObject}
                className="text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                + Ajouter 1
              </button>
            </div>
            <div className="space-y-2">
              {objects.length === 0 && (
                <p className="text-xs text-gray-600">Aucun objet pour l’instant.</p>
              )}
              {objects.map((obj, index) => (
                <div
                  key={index}
                  className="space-y-1.5 rounded-md border border-white/10 bg-white/5 p-2"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      value={obj.name}
                      onChange={(e) => updateObject(index, { name: e.target.value })}
                      placeholder="Nom de l’objet"
                      className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-100 outline-none focus:border-blue-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => removeObject(index)}
                      title="Retirer"
                      className="shrink-0 text-gray-500 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    value={obj.link ?? ''}
                    onChange={(e) => updateObject(index, { link: e.target.value || null })}
                    placeholder="Lien (optionnel)"
                    className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500/60"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLabelKind && (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-gray-400">Détails</label>
              <div className="flex shrink-0 items-center gap-1.5">
                <select
                  value={newDetailType}
                  onChange={(e) => setNewDetailType(e.target.value as InspirationDetailType)}
                  className="rounded border border-white/10 bg-white/5 px-1 py-1 text-xs text-gray-300 outline-none"
                >
                  {(Object.keys(DETAIL_TYPE_LABELS) as InspirationDetailType[]).map((type) => (
                    <option key={type} value={type} className="bg-[#15161a]">
                      {DETAIL_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addDetail}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  + Ajouter 1
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {details.length === 0 && (
                <p className="text-xs text-gray-600">Aucun détail pour l’instant.</p>
              )}
              {details.map((detail, index) => (
                <div
                  key={index}
                  className="space-y-1.5 rounded-md border border-white/10 bg-white/5 p-2"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      value={detail.name}
                      onChange={(e) => updateDetail(index, { name: e.target.value })}
                      placeholder="Nom"
                      className="min-w-0 flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-gray-100 outline-none focus:border-blue-500/60"
                    />
                    <span className="shrink-0 text-[10px] text-gray-500">
                      {DETAIL_TYPE_LABELS[detail.type]}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDetail(index)}
                      title="Retirer"
                      className="shrink-0 text-gray-500 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                  {detail.type === 'textarea' ? (
                    <textarea
                      value={detail.value}
                      onChange={(e) => updateDetail(index, { value: e.target.value })}
                      rows={3}
                      placeholder="Valeur"
                      className="w-full resize-y rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500/60"
                    />
                  ) : (
                    <input
                      type={detail.type === 'number' ? 'number' : 'text'}
                      value={detail.value}
                      onChange={(e) => updateDetail(index, { value: e.target.value })}
                      placeholder="Valeur"
                      className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500/60"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 p-4">
        {confirmingDelete ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-red-300">Supprimer cette carte ?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeleteClick}
                className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}
