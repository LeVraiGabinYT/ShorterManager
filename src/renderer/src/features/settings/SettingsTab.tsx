import { useEffect, useState, type ReactElement } from 'react'
import type { AppInfo, AppSettings, BackupImportResult, BackupMode } from '@shared/types'

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
    (result.channelRestored ? ' Connexion chaîne restaurée.' : '')
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

  useEffect(() => {
    window.api.app.getInfo().then(setAppInfo)
    window.api.settings.get().then((s) => {
      setSettings(s)
      setMaxRecentVideosInput(String(s.maxRecentVideos))
    })
  }, [])

  async function handleSaveMaxRecentVideos(): Promise<void> {
    const parsed = Math.min(50, Math.max(1, Math.round(Number(maxRecentVideosInput) || 25)))
    setMaxRecentVideosInput(String(parsed))
    const updated = await window.api.settings.update({ maxRecentVideos: parsed })
    setSettings(updated)
  }

  async function handleExport(): Promise<void> {
    setExporting(true)
    setExportMessage(null)
    const result = await window.api.backup.export()
    setExporting(false)
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
      </div>

      {pendingImportFile && (
        <ImportConfirmModal
          fileName={pendingImportFile.split(/[/\\]/).pop() ?? pendingImportFile}
          importing={importing}
          onCancel={() => setPendingImportFile(null)}
          onConfirm={handleConfirmImport}
        />
      )}
    </div>
  )
}
