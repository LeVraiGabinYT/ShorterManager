import { useEffect, useRef, useState, type DragEvent, type ReactElement } from 'react'
import type {
  AppInfo,
  BackupImportResult,
  BackupMode,
  IdeaStatus,
  OverviewSectionId,
  ReleaseNotes,
  UpdateStatus
} from '@shared/types'
import { DEFAULT_STATUS_COLORS, IDEA_STATUSES, OVERVIEW_SECTIONS } from '@shared/types'
import { useIdeasData } from '../../hooks/useIdeasData'
import { overviewSectionColor } from '../../lib/sectionColors'

function ImportConfirmModal({
  fileName,
  onCancel,
  onConfirm,
  importing
}: {
  fileName: string
  onCancel: () => void
  onConfirm: (mode: BackupMode) => void
  importing: boolean
}): ReactElement {
  const [mode, setMode] = useState<BackupMode>('merge')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#15161a] p-5 shadow-2xl">
        <h2 className="text-sm font-semibold text-gray-100">Importer « {fileName} »</h2>

        <div className="mt-4 space-y-3">
          <label
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors ${
              mode === 'merge'
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
              className="mt-0.5 accent-blue-600"
            />
            <span>
              <span className="block font-medium text-gray-100">Fusionner</span>
              <span className="block text-xs text-gray-400">
                Ajoute les nouveaux tags, séries, objets, idées et vidéos. Une idée dont le titre
                existe déjà n’est jamais dupliquée — elle est ignorée.
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors ${
              mode === 'replace'
                ? 'border-red-500/50 bg-red-500/10'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
              className="mt-0.5 accent-red-600"
            />
            <span>
              <span className="block font-medium text-gray-100">Remplacer</span>
              <span className="block text-xs text-gray-400">
                Efface toutes les données actuelles (idées, objets, tags, séries, vidéos, connexion
                chaîne) et les remplace par celles du fichier. Irréversible.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={importing}
            className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(mode)}
            disabled={importing}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
              mode === 'replace' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {importing ? 'Importation...' : mode === 'replace' ? 'Remplacer tout' : 'Fusionner'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatImportSummary(result: BackupImportResult): string {
  if (!result.success) return result.error ?? 'Échec de l’importation.'

  if (result.mode === 'replace') {
    return (
      `Remplacement terminé : ${result.addedIdeas ?? 0} idée(s), ${result.addedObjects ?? 0} objet(s), ` +
      `${result.addedTags ?? 0} tag(s), ${result.addedSeries ?? 0} série(s), ${result.addedVideos ?? 0} vidéo(s) restaurée(s).` +
      (result.channelRestored ? ' Connexion chaîne restaurée.' : '')
    )
  }

  return (
    `Fusion terminée : ${result.addedIdeas ?? 0} idée(s) ajoutée(s), ${result.skippedIdeas ?? 0} déjà existante(s) ignorée(s) (même titre), ` +
    `${result.addedTags ?? 0} tag(s), ${result.addedSeries ?? 0} série(s), ${result.addedObjects ?? 0} objet(s), ${result.addedVideos ?? 0} vidéo(s) ajoutée(s).` +
    (result.relinkedVideos
      ? ` ${result.relinkedVideos} vidéo(s) existante(s) reliée(s) à leur idée.`
      : '') +
    (result.channelRestored ? ' Connexion chaîne restaurée.' : '')
  )
}

function WipeConfirmModal({
  onCancel,
  onConfirm,
  wiping
}: {
  onCancel: () => void
  onConfirm: () => void
  wiping: boolean
}): ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#15161a] p-5 shadow-2xl">
        <h2 className="text-sm font-semibold text-gray-100">Supprimer toutes les données ?</h2>
        <p className="mt-2 text-xs text-gray-400">
          Idées, objets, tags, séries, vidéos et connexion à la chaîne seront définitivement
          effacés. Cette action est irréversible — pense à exporter une sauvegarde avant si besoin.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={wiping}
            className="rounded-md px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={wiping}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {wiping ? 'Suppression...' : 'Tout supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SettingsTab(): ReactElement {
  const { settings: contextSettings, setSettings, loading: dataLoading } = useIdeasData()
  const settings = dataLoading ? null : contextSettings
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [maxRecentVideosInput, setMaxRecentVideosInput] = useState('')

  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)

  const [pendingImportFile, setPendingImportFile] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importSucceeded, setImportSucceeded] = useState(false)

  const [confirmingWipe, setConfirmingWipe] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [wipeMessage, setWipeMessage] = useState<string | null>(null)
  const [wipeSucceeded, setWipeSucceeded] = useState(false)

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotes | null>(null)

  const [settingsExporting, setSettingsExporting] = useState(false)
  const [settingsExportMessage, setSettingsExportMessage] = useState<string | null>(null)
  const [settingsImportMessage, setSettingsImportMessage] = useState<string | null>(null)
  const [settingsImportSucceeded, setSettingsImportSucceeded] = useState(false)
  const [draggedSectionId, setDraggedSectionId] = useState<OverviewSectionId | null>(null)
  // `id: null` means "over the column's empty space / past its last item" (append), not over a
  // specific row — used only to highlight the drop target, never to compute the result: the
  // actual move is computed once, synchronously, in commitSectionMove on the real drop event.
  const [dragOverTarget, setDragOverTarget] = useState<{
    column: 'left' | 'right'
    id: OverviewSectionId | null
  } | null>(null)

  useEffect(() => {
    window.api.app.getInfo().then(setAppInfo)
    window.api.updates.getReleaseNotes().then(setReleaseNotes)
  }, [])

  // Seeds the free-typed input from the shared settings once they've loaded — only on that first
  // transition, so a later settings change from elsewhere never clobbers text the user is mid-typing.
  const maxRecentVideosSeededRef = useRef(false)
  useEffect(() => {
    if (dataLoading || maxRecentVideosSeededRef.current) return
    maxRecentVideosSeededRef.current = true
    setMaxRecentVideosInput(String(contextSettings.maxRecentVideos))
  }, [dataLoading, contextSettings.maxRecentVideos])

  useEffect(() => {
    let cancelled = false
    const poll = (): void => {
      window.api.updates.getStatus().then((s) => {
        if (!cancelled) setUpdateStatus(s)
      })
    }
    poll()
    const interval = setInterval(poll, 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  async function handleCheckUpdates(): Promise<void> {
    await window.api.updates.check()
  }

  async function handleDownloadUpdate(): Promise<void> {
    await window.api.updates.download()
  }

  async function handleInstallUpdate(): Promise<void> {
    await window.api.updates.installNow()
  }

  async function handleSaveMaxRecentVideos(): Promise<void> {
    const parsed = Math.min(50, Math.max(1, Math.round(Number(maxRecentVideosInput) || 25)))
    setMaxRecentVideosInput(String(parsed))
    const updated = await window.api.settings.update({ maxRecentVideos: parsed })
    setSettings(updated)
  }

  async function handleToggleRule(
    key: 'ruleAutoStatusOnLink' | 'ruleMissingObjectsPreparation',
    value: boolean
  ): Promise<void> {
    const updated = await window.api.settings.update({ [key]: value })
    setSettings(updated)
  }

  async function handleUpdateStatusColor(status: IdeaStatus, color: string): Promise<void> {
    if (!settings) return
    const updated = await window.api.settings.update({
      statusColors: { ...settings.statusColors, [status]: color }
    })
    setSettings(updated)
  }

  async function handleResetStatusColors(): Promise<void> {
    const updated = await window.api.settings.update({ statusColors: DEFAULT_STATUS_COLORS })
    setSettings(updated)
  }

  async function handleToggleShowTags(value: boolean): Promise<void> {
    const updated = await window.api.settings.update({ showTagsOnIdeaCard: value })
    setSettings(updated)
  }

  async function handleToggleOverviewSection(id: OverviewSectionId): Promise<void> {
    if (!settings) return
    const isVisible = settings.overviewVisibleSections.includes(id)
    const overviewVisibleSections = isVisible
      ? settings.overviewVisibleSections.filter((s) => s !== id)
      : [...settings.overviewVisibleSections, id]
    const updated = await window.api.settings.update({ overviewVisibleSections })
    setSettings(updated)
  }

  function handleSectionDragStart(id: OverviewSectionId): void {
    setDraggedSectionId(id)
  }

  function handleSectionDragEnd(): void {
    setDraggedSectionId(null)
    setDragOverTarget(null)
  }

  // Computes and persists the move exactly once, on the actual drop — not speculatively on every
  // dragenter — so there's a single source of truth for the result and no risk of a bubbled
  // dragenter on a parent column silently overriding a more precise in-column reorder.
  // `targetId: null` means "dropped past the last item" (append to the end of that column).
  async function commitSectionMove(
    column: 'left' | 'right',
    targetId: OverviewSectionId | null
  ): Promise<void> {
    const sourceId = draggedSectionId
    setDraggedSectionId(null)
    setDragOverTarget(null)
    if (!settings || !sourceId) return

    const left = settings.overviewColumnLeft.filter((id) => id !== sourceId)
    const right = settings.overviewColumnRight.filter((id) => id !== sourceId)
    const target = column === 'left' ? left : right
    const insertAt = targetId ? target.indexOf(targetId) : -1
    target.splice(insertAt === -1 ? target.length : insertAt, 0, sourceId)

    if (
      left.join(',') === settings.overviewColumnLeft.join(',') &&
      right.join(',') === settings.overviewColumnRight.join(',')
    ) {
      return
    }
    const updated = await window.api.settings.update({
      overviewColumnLeft: left,
      overviewColumnRight: right
    })
    setSettings(updated)
  }

  function handleSectionDrop(
    e: DragEvent<HTMLDivElement>,
    column: 'left' | 'right',
    targetId: OverviewSectionId
  ): void {
    e.preventDefault()
    e.stopPropagation()
    void commitSectionMove(column, targetId)
  }

  function handleColumnDrop(e: DragEvent<HTMLDivElement>, column: 'left' | 'right'): void {
    e.preventDefault()
    void commitSectionMove(column, null)
  }

  async function handleExportSettings(): Promise<void> {
    setSettingsExporting(true)
    setSettingsExportMessage(null)
    const result = await window.api.settings.export()
    setSettingsExporting(false)
    if (result.canceled) return
    setSettingsExportMessage(
      result.success
        ? `Paramètres exportés : ${result.path}`
        : (result.error ?? 'Échec de l’export.')
    )
  }

  async function handleImportSettings(): Promise<void> {
    const path = await window.api.settings.pickImportFile()
    if (!path) return
    const result = await window.api.settings.import(path)
    setSettingsImportSucceeded(result.success)
    setSettingsImportMessage(
      result.success ? 'Paramètres importés avec succès.' : (result.error ?? 'Échec de l’import.')
    )
    if (result.success) {
      const refreshed = await window.api.settings.get()
      setSettings(refreshed)
      setMaxRecentVideosInput(String(refreshed.maxRecentVideos))
      maxRecentVideosSeededRef.current = true
    }
  }

  async function handleExport(): Promise<void> {
    setExporting(true)
    setExportMessage(null)
    const result = await window.api.backup.export()
    setExporting(false)
    if (result.canceled) return
    setExportMessage(
      result.success ? `Sauvegarde créée : ${result.path}` : (result.error ?? 'Échec de l’export.')
    )
  }

  async function handlePickImportFile(): Promise<void> {
    const path = await window.api.backup.pickImportFile()
    if (path) {
      setImportMessage(null)
      setImportSucceeded(false)
      setPendingImportFile(path)
    }
  }

  async function handleConfirmImport(mode: BackupMode): Promise<void> {
    if (!pendingImportFile) return
    setImporting(true)
    const result = await window.api.backup.import(pendingImportFile, mode)
    setImporting(false)
    setPendingImportFile(null)
    setImportSucceeded(result.success)
    setImportMessage(formatImportSummary(result))
  }

  async function handleConfirmWipe(): Promise<void> {
    setWiping(true)
    const result = await window.api.backup.wipeAll()
    setWiping(false)
    setConfirmingWipe(false)
    setWipeSucceeded(result.success)
    setWipeMessage(
      result.success
        ? 'Toutes les données ont été supprimées.'
        : (result.error ?? 'Échec de la suppression.')
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Paramètres</h1>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-medium text-gray-200">Informations</h2>
          {appInfo && (
            <dl className="mt-3 space-y-1.5 text-xs text-gray-400">
              <div className="flex gap-2">
                <dt className="w-40 shrink-0 text-gray-500">Version</dt>
                <dd className="font-mono text-gray-300">{appInfo.version}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-40 shrink-0 text-gray-500">Base de données</dt>
                <dd className="break-all font-mono text-gray-300">{appInfo.dbPath}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-40 shrink-0 text-gray-500">Dossier de données</dt>
                <dd className="break-all font-mono text-gray-300">{appInfo.userDataPath}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-medium text-gray-200">Mises à jour</h2>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleCheckUpdates}
              disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Vérifier les mises à jour
            </button>

            {updateStatus.state === 'available' && (
              <button
                onClick={handleDownloadUpdate}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                Télécharger la version {updateStatus.version}
              </button>
            )}

            {updateStatus.state === 'downloaded' && (
              <button
                onClick={handleInstallUpdate}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Redémarrer et installer ({updateStatus.version})
              </button>
            )}
          </div>

          <p className="mt-3 text-xs text-gray-400">
            {updateStatus.state === 'idle' && 'Aucune vérification récente.'}
            {updateStatus.state === 'checking' && 'Vérification en cours...'}
            {updateStatus.state === 'not-available' && 'Tu as déjà la dernière version installée.'}
            {updateStatus.state === 'available' &&
              `Nouvelle version disponible : ${updateStatus.version}.`}
            {updateStatus.state === 'downloading' &&
              `Téléchargement en cours... ${updateStatus.percent}%`}
            {updateStatus.state === 'downloaded' &&
              `Version ${updateStatus.version} téléchargée, prête à installer.`}
            {updateStatus.state === 'error' && (
              <span className="text-red-300">{updateStatus.message}</span>
            )}
          </p>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-medium text-gray-200">Notes de version</h2>
          {releaseNotes === null ? (
            <p className="mt-3 text-xs text-gray-500">Chargement...</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-gray-500">Version {releaseNotes.version}</p>
              {releaseNotes.notes ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-300">
                  {releaseNotes.notes}
                </p>
              ) : (
                <p className="mt-3 text-xs text-gray-500">
                  {releaseNotes.error ?? 'Aucune note pour cette version.'}
                </p>
              )}
              <a
                href={releaseNotes.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs text-blue-300 hover:underline"
              >
                Voir sur GitHub →
              </a>
            </>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-medium text-gray-200">Général</h2>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Nombre de vidéos récentes à récupérer lors de l’actualisation de la chaîne
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                value={maxRecentVideosInput}
                onChange={(e) => setMaxRecentVideosInput(e.target.value)}
                onBlur={handleSaveMaxRecentVideos}
                className="w-24 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 outline-none focus:border-blue-500/60"
              />
              <span className="text-xs text-gray-500">
                (entre 1 et 50 — limite de l’API YouTube)
              </span>
            </div>
            {settings && (
              <p className="mt-1 text-xs text-gray-600">
                Valeur actuelle : {settings.maxRecentVideos}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-medium text-gray-200">Règles</h2>
          <p className="mt-1 text-xs text-gray-500">
            Automatisations activées par défaut qui configurent les idées à ta place. Désactive-les
            si tu préfères tout gérer manuellement.
          </p>

          {settings && (
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.ruleAutoStatusOnLink}
                  onChange={(e) => handleToggleRule('ruleAutoStatusOnLink', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-600"
                />
                <span>
                  <span className="block text-gray-200">Statut automatique à la liaison</span>
                  <span className="block text-xs text-gray-500">
                    Lier une idée à une vraie vidéo la passe en « Publiée » — sauf si la vidéo date
                    d’aujourd’hui avec 0 vue, auquel cas elle est plutôt marquée « Programmée ».
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.ruleMissingObjectsPreparation}
                  onChange={(e) =>
                    handleToggleRule('ruleMissingObjectsPreparation', e.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-600"
                />
                <span>
                  <span className="block text-gray-200">Préparation si objet manquant</span>
                  <span className="block text-xs text-gray-500">
                    Une idée avec un objet non acheté s’affiche automatiquement comme « Préparation
                    » — impossible de filmer sans le matériel nécessaire.
                  </span>
                </span>
              </label>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-medium text-gray-200">Personnalisation</h2>

          {settings && (
            <div className="mt-3 space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-400">
                    Couleurs des statuts
                  </label>
                  <button
                    type="button"
                    onClick={handleResetStatusColors}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    Réinitialiser
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {IDEA_STATUSES.map((s) => (
                    <label key={s.value} className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="color"
                        value={settings.statusColors[s.value]}
                        onChange={(e) => handleUpdateStatusColor(s.value, e.target.value)}
                        className="h-7 w-9 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.showTagsOnIdeaCard}
                  onChange={(e) => handleToggleShowTags(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 accent-blue-600"
                />
                <span>
                  <span className="block text-gray-200">
                    Afficher les tags sous le titre des idées
                  </span>
                  <span className="block text-xs text-gray-500">
                    Montre les tags de chaque idée directement dans les listes (Idées, Vue
                    d’ensemble, Plannings, Séries).
                  </span>
                </span>
              </label>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Sections de la Vue d’ensemble
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Coche les sections à afficher et glisse-les pour changer leur ordre ou les passer
                  d’une colonne à l’autre — les couleurs reprennent celles de la Vue d’ensemble.
                </p>
                <div className="grid max-w-md grid-cols-2 gap-3">
                  {(['left', 'right'] as const).map((column) => {
                    const columnIds =
                      column === 'left' ? settings.overviewColumnLeft : settings.overviewColumnRight
                    const isOverColumnEnd =
                      dragOverTarget?.column === column && dragOverTarget.id === null
                    return (
                      <div
                        key={column}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={() => setDragOverTarget({ column, id: null })}
                        onDrop={(e) => handleColumnDrop(e, column)}
                        className={`min-h-[2.5rem] space-y-1.5 rounded-md border border-dashed p-1.5 transition-colors ${
                          isOverColumnEnd ? 'border-blue-400/60 bg-blue-500/5' : 'border-white/10'
                        }`}
                      >
                        {columnIds.map((id) => {
                          const label = OVERVIEW_SECTIONS.find((s) => s.id === id)?.label ?? id
                          const visible = settings.overviewVisibleSections.includes(id)
                          const color = overviewSectionColor(id, settings.statusColors)
                          const isDropTarget =
                            dragOverTarget?.column === column && dragOverTarget.id === id
                          return (
                            <div
                              key={id}
                              draggable
                              onDragStart={() => handleSectionDragStart(id)}
                              onDragOver={(e) => e.preventDefault()}
                              onDragEnter={(e) => {
                                e.stopPropagation()
                                setDragOverTarget({ column, id })
                              }}
                              onDrop={(e) => handleSectionDrop(e, column, id)}
                              onDragEnd={handleSectionDragEnd}
                              style={{ backgroundColor: `${color}1f`, borderColor: `${color}55` }}
                              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-opacity ${
                                draggedSectionId === id ? 'opacity-40' : ''
                              } ${isDropTarget ? '!border-blue-400' : ''} ${visible ? '' : 'opacity-50'}`}
                            >
                              <span
                                className="shrink-0 cursor-grab select-none text-xs text-gray-400 active:cursor-grabbing"
                                title="Glisser pour réordonner ou changer de colonne"
                              >
                                ⠿
                              </span>
                              <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-gray-200">
                                <input
                                  type="checkbox"
                                  checked={visible}
                                  onChange={() => handleToggleOverviewSection(id)}
                                  className="h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-white/5 accent-blue-600"
                                />
                                <span className="truncate">{label}</span>
                              </label>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-medium text-gray-200">Sauvegarde des paramètres</h2>
          <p className="mt-1 text-xs text-gray-500">
            Exporte ou restaure uniquement tes préférences (couleurs, règles, disposition) —
            indépendant de la sauvegarde des données ci-dessous.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleExportSettings}
              disabled={settingsExporting}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {settingsExporting ? 'Export en cours...' : 'Exporter les paramètres'}
            </button>
            <button
              onClick={handleImportSettings}
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
            >
              Importer...
            </button>
          </div>

          {settingsExportMessage && (
            <p className="mt-3 break-all rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
              {settingsExportMessage}
            </p>
          )}

          {settingsImportMessage && (
            <p
              className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                settingsImportSucceeded
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-red-500/40 bg-red-500/10 text-red-200'
              }`}
            >
              {settingsImportMessage}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-medium text-gray-200">Sauvegarde des données</h2>
          <p className="mt-1 text-xs text-gray-500">
            Exporte ou restaure la totalité du tableau de bord : idées, objets, tags, séries, vidéos
            et connexion à la chaîne.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? 'Export en cours...' : 'Exporter'}
            </button>
            <button
              onClick={handlePickImportFile}
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5"
            >
              Importer...
            </button>
          </div>

          {exportMessage && (
            <p className="mt-3 break-all rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
              {exportMessage}
            </p>
          )}

          {importMessage && (
            <div className="mt-3 space-y-2">
              <p
                className={`rounded-md border px-3 py-2 text-xs ${
                  importSucceeded
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-red-500/40 bg-red-500/10 text-red-200'
                }`}
              >
                {importMessage}
              </p>
              {importSucceeded && (
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Recharger l’application
                </button>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <h2 className="text-sm font-medium text-red-300">Zone dangereuse</h2>
          <p className="mt-1 text-xs text-gray-400">
            Supprime définitivement toutes les données locales (idées, objets, tags, séries, vidéos,
            connexion à la chaîne) — utile pour tester une restauration depuis une sauvegarde à
            partir d’un état vide.
          </p>
          <button
            onClick={() => setConfirmingWipe(true)}
            className="mt-3 rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
          >
            Supprimer toutes les données
          </button>

          {wipeMessage && (
            <div className="mt-3 space-y-2">
              <p
                className={`rounded-md border px-3 py-2 text-xs ${
                  wipeSucceeded
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-red-500/40 bg-red-500/10 text-red-200'
                }`}
              >
                {wipeMessage}
              </p>
              {wipeSucceeded && (
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Recharger l’application
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {pendingImportFile && (
        <ImportConfirmModal
          fileName={pendingImportFile.split(/[/\\]/).pop() ?? pendingImportFile}
          importing={importing}
          onCancel={() => setPendingImportFile(null)}
          onConfirm={handleConfirmImport}
        />
      )}

      {confirmingWipe && (
        <WipeConfirmModal
          wiping={wiping}
          onCancel={() => setConfirmingWipe(false)}
          onConfirm={handleConfirmWipe}
        />
      )}
    </div>
  )
}
