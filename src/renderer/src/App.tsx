import { useState, type ReactElement } from 'react'
import { IdeasTab } from './features/ideas/IdeasTab'
import { ObjectsTab } from './features/objects/ObjectsTab'
import { ChannelTab } from './features/channel/ChannelTab'

const TABS = [
  { id: 'ideas', label: 'Idées' },
  { id: 'objects', label: 'Objets achetés' },
  { id: 'channel', label: 'Chaîne YouTube' }
] as const

type TabId = (typeof TABS)[number]['id']

function App(): ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('ideas')

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
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-hidden">
        {activeTab === 'ideas' && <IdeasTab />}
        {activeTab === 'objects' && <ObjectsTab />}
        {activeTab === 'channel' && <ChannelTab />}
      </main>
    </div>
  )
}

export default App
