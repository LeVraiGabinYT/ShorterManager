import { useState, type ReactElement } from 'react'
import type { PublishedVideo, Tag } from '@shared/types'
import { AnalysisVideoRow } from './AnalysisVideoRow'

type GroupId = 'blue' | 'orange'

const GROUP_LABEL: Record<GroupId, string> = { blue: 'Groupe Bleu', orange: 'Groupe Orange' }
const GROUP_COLOR: Record<GroupId, string> = { blue: '#3987e5', orange: '#d95926' }

interface GroupColumnProps {
  group: GroupId
  videos: PublishedVideo[]
  tagsById: Map<number, Tag>
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onAddClick: () => void
  onMoveOne: (id: string) => void
  onMoveSelected: () => void
  onRemoveOne: (id: string) => void
  onRemoveSelected: () => void
  onClearGroup: () => void
}

function GroupColumn({
  group,
  videos,
  tagsById,
  selectedIds,
  onToggleSelect,
  onAddClick,
  onMoveOne,
  onMoveSelected,
  onRemoveOne,
  onRemoveSelected,
  onClearGroup
}: GroupColumnProps): ReactElement {
  const color = GROUP_COLOR[group]
  const otherLabel = group === 'blue' ? 'Orange' : 'Bleu'
  const selectedInGroup = videos.filter((v) => selectedIds.has(v.youtubeVideoId)).length
  const [confirmingClear, setConfirmingClear] = useState(false)

  return (
    <div
      style={{ backgroundColor: `${color}0f`, borderColor: `${color}40` }}
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 p-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-200">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          {GROUP_LABEL[group]} ({videos.length})
        </h3>
        <div className="flex items-center gap-1.5">
          {confirmingClear ? (
            <span className="flex items-center gap-1.5 text-xs">
              <span className="text-red-300">Vider le groupe ?</span>
              <button
                type="button"
                onClick={() => {
                  onClearGroup()
                  setConfirmingClear(false)
                }}
                className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-500"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              disabled={videos.length === 0}
              className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-gray-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Vider
            </button>
          )}
          <button
            type="button"
            onClick={onAddClick}
            style={{ borderColor: `${color}66`, color }}
            className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-white/5"
          >
            + Ajouter des vidéos
          </button>
        </div>
      </div>

      {selectedInGroup > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2 px-3 pb-2">
          <button
            type="button"
            onClick={onMoveSelected}
            className="rounded-md border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-gray-200 hover:bg-white/10"
          >
            → Passer {selectedInGroup} vidéo{selectedInGroup > 1 ? 's' : ''} au groupe {otherLabel}
          </button>
          <button
            type="button"
            onClick={onRemoveSelected}
            className="rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/10"
          >
            ✕ Retirer {selectedInGroup} vidéo{selectedInGroup > 1 ? 's' : ''}
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {videos.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune vidéo dans ce groupe pour l’instant.</p>
        ) : (
          videos.map((video) => (
            <AnalysisVideoRow
              key={video.youtubeVideoId}
              video={video}
              tagsById={tagsById}
              selected={selectedIds.has(video.youtubeVideoId)}
              onToggle={() => onToggleSelect(video.youtubeVideoId)}
              trailingAction={
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveOne(video.youtubeVideoId)}
                    title={`Passer au groupe ${otherLabel}`}
                    className="rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-gray-200"
                  >
                    → {otherLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveOne(video.youtubeVideoId)}
                    title="Retirer du groupe"
                    className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-red-500/10 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
              }
            />
          ))
        )}
      </div>
    </div>
  )
}

interface GroupVideosPanelProps {
  blueVideos: PublishedVideo[]
  orangeVideos: PublishedVideo[]
  tagsById: Map<number, Tag>
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onAddClick: (group: GroupId) => void
  onMoveOne: (id: string, from: GroupId) => void
  onMoveSelected: (from: GroupId) => void
  onRemoveOne: (id: string, from: GroupId) => void
  onRemoveSelected: (from: GroupId) => void
  onClearGroup: (group: GroupId) => void
}

export function GroupVideosPanel({
  blueVideos,
  orangeVideos,
  tagsById,
  selectedIds,
  onToggleSelect,
  onAddClick,
  onMoveOne,
  onMoveSelected,
  onRemoveOne,
  onRemoveSelected,
  onClearGroup
}: GroupVideosPanelProps): ReactElement {
  return (
    <div className="grid min-h-[22rem] grid-cols-1 gap-3 lg:grid-cols-2">
      <GroupColumn
        group="blue"
        videos={blueVideos}
        tagsById={tagsById}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onAddClick={() => onAddClick('blue')}
        onMoveOne={(id) => onMoveOne(id, 'blue')}
        onMoveSelected={() => onMoveSelected('blue')}
        onRemoveOne={(id) => onRemoveOne(id, 'blue')}
        onRemoveSelected={() => onRemoveSelected('blue')}
        onClearGroup={() => onClearGroup('blue')}
      />
      <GroupColumn
        group="orange"
        videos={orangeVideos}
        tagsById={tagsById}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onAddClick={() => onAddClick('orange')}
        onMoveOne={(id) => onMoveOne(id, 'orange')}
        onMoveSelected={() => onMoveSelected('orange')}
        onRemoveOne={(id) => onRemoveOne(id, 'orange')}
        onRemoveSelected={() => onRemoveSelected('orange')}
        onClearGroup={() => onClearGroup('orange')}
      />
    </div>
  )
}
