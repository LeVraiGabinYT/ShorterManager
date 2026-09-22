import type { ReactElement } from 'react'
import { AnalysisTab } from '../analysis/AnalysisTab'
import { InspirationsTab } from '../inspirations/InspirationsTab'
import { StatsTab } from '../stats/StatsTab'

const SUB_TABS = [
  { id: 'analysis', label: 'Analyse' },
  { id: 'inspirations', label: 'Inspirations' },
  { id: 'stats', label: 'Stats' }
] as const

export type ToolsSubTabId = (typeof SUB_TABS)[number]['id']
export const TOOLS_SUB_TAB_IDS: ToolsSubTabId[] = SUB_TABS.map((t) => t.id)

interface ToolsTabProps {
  activeSubTab: ToolsSubTabId
  onSubTabChange: (id: ToolsSubTabId) => void
  onNavigateToIdea: (ideaId: number) => void
}

// Sub-tab is controlled by App (not local state), mirroring VideosTab, so a future cross-tab link
// (e.g. from Vue d'ensemble) could jump straight to a specific Outils sub-tab.
export function ToolsTab({
  activeSubTab,
  onSubTabChange,
  onNavigateToIdea
}: ToolsTabProps): ReactElement {
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
        {activeSubTab === 'analysis' && <AnalysisTab />}
        {activeSubTab === 'inspirations' && <InspirationsTab onNavigateToIdea={onNavigateToIdea} />}
        {activeSubTab === 'stats' && <StatsTab />}
      </div>
    </div>
  )
}
