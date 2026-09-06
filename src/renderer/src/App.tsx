import { useEffect, useState, type ReactElement } from 'react'
import type { UpdateStatus } from '@shared/types'
import { UpdateAvailableModal } from './components/UpdateAvailableModal'
import { OverviewTab } from './features/overview/OverviewTab'
import { VideosTab, type IdeasFilterPreset, type VideosSubTabId } from './features/videos/VideosTab'
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
  const [activeTab, setActiveTab] = useState<TabId>('videos')
  const [videosSubTab, setVideosSubTab] = useState<VideosSubTabId>('ideas')
  const [ideasFilterPreset, setIdeasFilterPreset] = useState<IdeasFilterPreset>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  function handleNavigateToTasks(): void {
    setActiveTab('videos')
    setVideosSubTab('tasks')
  }

  function handleNavigateToIdeas(preset: IdeasFilterPreset): void {
    setActiveTab('videos')
    setVideosSubTab('ideas')
    setIdeasFilterPreset(preset)
  }

  // Polls the same status the main process's autoUpdater maintains, so the popup reacts whether
  // the startup check found it or the user triggered a check manually from Paramètres.
  useEffect(() => {
    let cancelled = false
    const poll = (): void => {
      window.api.updates.getStatus().then((s) => {
        if (!cancelled) setUpdateStatus(s)
      })
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  async function handleInstallUpdate(): Promise<void> {
    await window.api.updates.download()
  }

  async function handleRestartAndInstall(): Promise<void> {
    await window.api.updates.installNow()
  }

  function handleDismissUpdate(): void {
    if (updateStatus.state === 'available' || updateStatus.state === 'downloaded') {
      setDismissedVersion(updateStatus.version)
    }
  }

  const showUpdateModal =
    (updateStatus.state === 'available' && updateStatus.version !== dismissedVersion) ||
    updateStatus.state === 'downloading' ||
    (updateStatus.state === 'downloaded' && updateStatus.version !== dismissedVersion)

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
        {activeTab === 'overview' && (
          <OverviewTab
            onNavigateToTasks={handleNavigateToTasks}
            onNavigateToIdeas={() => handleNavigateToIdeas('ideasOnly')}
            onNavigateToInProgress={() => handleNavigateToIdeas('inProgress')}
          />
        )}
        {activeTab === 'videos' && (
          <VideosTab
            activeSubTab={videosSubTab}
            onSubTabChange={setVideosSubTab}
            ideasFilterPreset={ideasFilterPreset}
            onIdeasFilterPresetConsumed={() => setIdeasFilterPreset(null)}
          />
        )}
        {activeTab === 'properties' && <PropertiesTab />}
        {activeTab === 'analysis' && <AnalysisTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>

      {showUpdateModal &&
        (updateStatus.state === 'available' ||
          updateStatus.state === 'downloading' ||
          updateStatus.state === 'downloaded') && (
          <UpdateAvailableModal
            status={updateStatus}
            onInstall={handleInstallUpdate}
            onRestart={handleRestartAndInstall}
            onDismiss={handleDismissUpdate}
          />
        )}
    </div>
  )
}

export default App
