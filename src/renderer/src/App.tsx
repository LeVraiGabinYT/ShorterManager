import { useState, type ReactElement } from 'react'
import { OverviewTab } from './features/overview/OverviewTab'
import { VideosTab } from './features/videos/VideosTab'
import { PropertiesTab } from './features/properties/PropertiesTab'
import { AnalysisTab } from './features/analysis/AnalysisTab'
import { SettingsTab } from './features/settings/SettingsTab'

const TABS = [
  { id: 'overview', label: 'Vue d’ensemble' },
  { id: 'videos', label: 'Vidéos' },
  { id: 'properties', label: 'Propriétés' },
  { id: 'analysis', label: 'Analyse' },
  { id: 'settings', label: 'Paramètres' }
] as const

type TabId = (typeof TABS)[number]['id']

function App(): ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  return (
    <div className="flex h-screen flex-col bg-[#0b0c0f]">
      <nav className="flex shrink-0 gap-1 border-b border-white/10 px-4 pt-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white/5 text-gray-100 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            } ${tab.id === 'settings' ? 'ml-auto' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-hidden">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'videos' && <VideosTab />}
        {activeTab === 'properties' && <PropertiesTab />}
        {activeTab === 'analysis' && <AnalysisTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  )
}

export default App
