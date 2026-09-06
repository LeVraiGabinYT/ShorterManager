import type { ReactElement } from 'react'
import type { UpdateStatus } from '@shared/types'

interface UpdateAvailableModalProps {
  status: Extract<UpdateStatus, { state: 'available' | 'downloading' | 'downloaded' }>
  onInstall: () => void
  onRestart: () => void
  onDismiss: () => void
}

export function UpdateAvailableModal({
  status,
  onInstall,
  onRestart,
  onDismiss
}: UpdateAvailableModalProps): ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[#15161a] p-5 shadow-xl">
        <h2 className="text-base font-semibold text-gray-100">Mise à jour disponible</h2>

        {status.state === 'available' && (
          <>
            <p className="mt-2 text-sm text-gray-400">
              La version {status.version} de ShorterManager est disponible. Voulez-vous l’installer
              maintenant ?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
              >
                Plus tard
              </button>
              <button
                type="button"
                onClick={onInstall}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                Installer
              </button>
            </div>
          </>
        )}

        {status.state === 'downloading' && (
          <>
            <p className="mt-2 text-sm text-gray-400">
              Téléchargement en cours... {status.percent}%
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${status.percent}%` }}
              />
            </div>
          </>
        )}

        {status.state === 'downloaded' && (
          <>
            <p className="mt-2 text-sm text-gray-400">
              Version {status.version} téléchargée. Redémarre l’application pour l’installer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
              >
                Plus tard
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                Redémarrer et installer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
