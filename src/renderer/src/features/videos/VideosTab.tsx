import type { ReactElement } from 'react'
import { ChannelTab } from '../channel/ChannelTab'
import { IdeasTab } from '../ideas/IdeasTab'
import { PlanningsTab } from '../plannings/PlanningsTab'
import { SeriesTab } from '../series/SeriesTab'
import { TasksTab } from '../tasks/TasksTab'

const SUB_TABS = [
  { id: 'plannings', label: 'Plannings' },
  { id: 'tasks', label: 'Tâches' },
  { id: 'ideas', label: 'Idées' },
  { id: 'series', label: 'Séries' },
  { id: 'channel', label: 'Chaîne YouTube' }
] as const

export type VideosSubTabId = (typeof SUB_TABS)[number]['id']

// Which quick filter preset (see IdeasTab's own "Idées" / "En cours" chips) to activate as soon
// as the Idées sub-tab mounts — set by whichever caller navigated here, e.g. one of Vue
// d'ensemble's stat-card "Voir..." links. null means "no preset, use whatever was last saved".
export type IdeasFilterPreset = 'ideasOnly' | 'inProgress' | null

interface VideosTabProps {
  activeSubTab: VideosSubTabId
  onSubTabChange: (id: VideosSubTabId) => void
  ideasFilterPreset?: IdeasFilterPreset
  onIdeasFilterPresetConsumed?: () => void
}

// Sub-tab is controlled by App (not local state) so other tabs — Vue d'ensemble's "Voir les
// tâches" / "Voir les idées" / "Voir les vidéos en cours" links, for instance — can jump straight
// to a specific sub-tab (and filter preset) here.
export function VideosTab({
  activeSubTab,
  onSubTabChange,
  ideasFilterPreset,
  onIdeasFilterPresetConsumed
}: VideosTabProps): ReactElement {
  return (
    <div className="flex h-full flex-col">
      <nav className="flex shrink-0 gap-1 border-b border-white/10 px-6 pt-3">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={`rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeSubTab === tab.id
                ? 'bg-white/5 text-gray-100 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeSubTab === 'plannings' && <PlanningsTab />}
        {activeSubTab === 'tasks' && <TasksTab />}
        {activeSubTab === 'ideas' && (
          <IdeasTab
            activateFilterPreset={ideasFilterPreset ?? undefined}
            onFilterPresetActivated={onIdeasFilterPresetConsumed}
          />
        )}
        {activeSubTab === 'series' && <SeriesTab />}
        {activeSubTab === 'channel' && <ChannelTab />}
      </div>
    </div>
  )
}
