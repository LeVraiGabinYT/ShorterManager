import { useState, type ReactElement } from 'react'
import { useAnalysisGroups } from '../../hooks/useAnalysisGroups'
import { useIdeasData } from '../../hooks/useIdeasData'
import { ExplorerPanel } from './ExplorerPanel'
import { GroupsPanel } from './GroupsPanel'
import { TimelinePanel } from './TimelinePanel'

const SUB_TABS = [
  { id: 'explorer', label: 'Explorer' },
  { id: 'groups', label: 'Groupes' },
  { id: 'timeline', label: 'Chronologie' }
] as const

type SubTabId = (typeof SUB_TABS)[number]['id']

export function AnalysisTab(): ReactElement {
  const { ideas, ideasById, tags, tagsById, objects, publishedVideos } = useIdeasData()
  const [subTab, setSubTab] = useState<SubTabId>('explorer')
  const { groups, refresh: refreshGroups } = useAnalysisGroups()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Analyse</h1>
        <nav className="flex gap-1">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                subTab === tab.id
                  ? 'bg-white/10 text-gray-100'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {publishedVideos.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune vidéo publiée en cache pour l’instant. Va dans l’onglet « Chaîne YouTube » et
            actualise les vidéos avant de pouvoir les analyser.
          </p>
        ) : (
          <>
            {subTab === 'explorer' && (
              <ExplorerPanel
                publishedVideos={publishedVideos}
                ideasById={ideasById}
                tags={tags}
                tagsById={tagsById}
                objects={objects}
                groups={groups}
                onGroupsChanged={refreshGroups}
              />
            )}
            {subTab === 'groups' && (
              <GroupsPanel
                groups={groups}
                publishedVideos={publishedVideos}
                onGroupsChanged={refreshGroups}
              />
            )}
            {subTab === 'timeline' && (
              <TimelinePanel tags={tags} publishedVideos={publishedVideos} ideas={ideas} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
