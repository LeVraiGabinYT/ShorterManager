import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { ContentFormat, UpdateStatus } from '@shared/types'
import { UpdateAvailableModal } from './components/UpdateAvailableModal'
import { usePersistedState } from './hooks/usePersistedState'
import { useIdeasData } from './hooks/useIdeasData'
import { OverviewTab } from './features/overview/OverviewTab'
import {
  VIDEOS_SUB_TAB_IDS,
  VideosTab,
  type IdeasFilterPreset,
  type VideosSubTabId
} from './features/videos/VideosTab'
import { PropertiesTab } from './features/properties/PropertiesTab'
import { TOOLS_SUB_TAB_IDS, ToolsTab, type ToolsSubTabId } from './features/tools/ToolsTab'
import { SettingsTab } from './features/settings/SettingsTab'

const ALL_TABS = [
  { id: 'overview', label: 'Vue d’ensemble' },
  { id: 'videos', label: 'Vidéos' },
  { id: 'properties', label: 'Propriétés' },
  { id: 'tools', label: 'Outils' },
  { id: 'settings', label: 'Paramètres' }
] as const

type TabId = (typeof ALL_TABS)[number]['id']

function isVideosSubTabId(value: unknown): value is VideosSubTabId {
  return typeof value === 'string' && (VIDEOS_SUB_TAB_IDS as readonly string[]).includes(value)
}

function isToolsSubTabId(value: unknown): value is ToolsSubTabId {
  return typeof value === 'string' && (TOOLS_SUB_TAB_IDS as readonly string[]).includes(value)
}

function App(): ReactElement {
  const { settings, ideasById } = useIdeasData()
  // "Propriétés" (tags/objets) is hidden entirely from the nav when the global toggle is off —
  // the tab, and everything it manages, still exists underneath, just not surfaced.
  const tabs = useMemo(
    () => ALL_TABS.filter((tab) => tab.id !== 'properties' || settings.showTagsAndObjects),
    [settings.showTagsAndObjects]
  )

  // The main tab always starts on Vue d'ensemble — only which SUB-tab/filter you had open inside
  // Vidéos is remembered (localStorage) across restarts, same lightweight pattern as the Outils
  // tab's sub-tab and the Idées tab's filters.
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [videosSubTab, setVideosSubTab] = usePersistedState<VideosSubTabId>(
    'app.videosSubTab',
    'shorts',
    isVideosSubTabId
  )
  const [toolsSubTab, setToolsSubTab] = usePersistedState<ToolsSubTabId>(
    'app.toolsSubTab',
    'analysis',
    isToolsSubTabId
  )

  // If Propriétés gets hidden while it's the active tab (setting toggled off from elsewhere, or
  // restored from a settings import), fall back to Vue d'ensemble rather than showing a dead tab.
  useEffect(() => {
    if (activeTab === 'properties' && !settings.showTagsAndObjects) {
      setActiveTab('overview')
    }
  }, [activeTab, settings.showTagsAndObjects])
  const [ideasFilterPreset, setIdeasFilterPreset] = useState<IdeasFilterPreset>(null)
  const [openIdeaId, setOpenIdeaId] = useState<number | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  function handleNavigateToTasks(): void {
    setActiveTab('videos')
    setVideosSubTab('tasks')
  }

  // format is undefined when Vue d'ensemble's own Shorts/Longues toggle is on "Tout" — there's no
  // format signal to go on then, so it defaults to the Shorts tab (the majority case).
  function handleNavigateToIdeas(preset: IdeasFilterPreset, format?: ContentFormat): void {
    setActiveTab('videos')
    setVideosSubTab(format === 'long' ? 'longs' : 'shorts')
    setIdeasFilterPreset(preset)
  }

  function handleNavigateToIdea(ideaId: number): void {
    setActiveTab('videos')
    setVideosSubTab(ideasById.get(ideaId)?.format === 'long' ? 'longs' : 'shorts')
    setOpenIdeaId(ideaId)
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
        {tabs.map((tab) => (
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
            onNavigateToIdeas={(format) => handleNavigateToIdeas('ideasOnly', format)}
            onNavigateToInProgress={(format) => handleNavigateToIdeas('inProgress', format)}
          />
        )}
        {activeTab === 'videos' && (
          <VideosTab
            activeSubTab={videosSubTab}
            onSubTabChange={setVideosSubTab}
            ideasFilterPreset={ideasFilterPreset}
            onIdeasFilterPresetConsumed={() => setIdeasFilterPreset(null)}
            openIdeaId={openIdeaId}
            onOpenIdeaConsumed={() => setOpenIdeaId(null)}
          />
        )}
        {activeTab === 'properties' && settings.showTagsAndObjects && <PropertiesTab />}
        {activeTab === 'tools' && (
          <ToolsTab
            activeSubTab={toolsSubTab}
            onSubTabChange={setToolsSubTab}
            onNavigateToIdea={handleNavigateToIdea}
          />
        )}
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
