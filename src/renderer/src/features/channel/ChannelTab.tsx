import type { ReactElement } from 'react'

export function ChannelTab(): ReactElement {
  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">Chaîne YouTube</h1>
      </div>

      <div className="flex-1 px-6 pb-6">
        <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-6">
          <p className="text-sm text-gray-300">
            Cette section permettra de connecter ta chaîne YouTube via OAuth Google (YouTube Data
            API) pour :
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-400 list-disc list-inside">
            <li>Lier automatiquement une vidéo publiée à l’idée correspondante</li>
            <li>Comparer les performances (vues, likes, commentaires) entre idées similaires</li>
            <li>Suivre l’évolution de la chaîne directement depuis l’app</li>
          </ul>
          <button
            disabled
            className="mt-5 cursor-not-allowed rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-gray-400"
            title="Bientôt disponible"
          >
            Connecter ma chaîne YouTube (bientôt)
          </button>
        </div>
      </div>
    </div>
  )
}
