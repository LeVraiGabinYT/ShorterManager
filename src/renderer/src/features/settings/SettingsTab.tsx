import { useEffect, useState, type ReactElement } from 'react'
import type {
  AppInfo,
  AppSettings,
  BackupImportResult,
  BackupMode,
  UpdateStatus
} from '@shared/types'

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
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
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

  useEffect(() => {
    window.api.app.getInfo().then(setAppInfo)
    window.api.settings.get().then((s) => {
      setSettings(s)
      setMaxRecentVideosInput(String(s.maxRecentVideos))
    })
  }, [])

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
