import { useState, type ReactElement } from 'react'
import { ChannelTab } from '../channel/ChannelTab'
import { IdeasTab } from '../ideas/IdeasTab'
import { PlanningsTab } from '../plannings/PlanningsTab'
import { SeriesTab } from '../series/SeriesTab'

const SUB_TABS = [
  { id: 'plannings', label: 'Plannings' },
  { id: 'ideas', label: 'Idées' },
  { id: 'series', label: 'Séries' },
  { id: 'channel', label: 'Chaîne YouTube' }
] as const

type SubTabId = (typeof SUB_TABS)[number]['id']

export function VideosTab(): ReactElement {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('ideas')

  return (
    <div className="flex h-full flex-col">
      <nav className="flex shrink-0 gap-1 border-b border-white/10 px-6 pt-3">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
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
        {activeSubTab === 'ideas' && <IdeasTab />}
        {activeSubTab === 'series' && <SeriesTab />}
        {activeSubTab === 'channel' && <ChannelTab />}
      </div>
    </div>
  )
}
