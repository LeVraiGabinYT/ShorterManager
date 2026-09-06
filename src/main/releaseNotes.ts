import { app } from 'electron'
import type { ReleaseNotes } from '../shared/types'

const OWNER = 'LeVraiGabinYT'
const REPO = 'ShorterManager'

interface GithubReleaseResponse {
  body?: string
}

/**
 * Pulls the current app version's release notes straight from its GitHub Release — the same
 * release electron-updater already publishes to, so notes stay in sync with what auto-update
 * offers without bundling a separate changelog file into the app.
 */
export async function getReleaseNotes(): Promise<ReleaseNotes> {
  const version = app.getVersion()
  const tag = `v${version}`
  const url = `https://github.com/${OWNER}/${REPO}/releases/tag/${tag}`

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${tag}`,
      { headers: { Accept: 'application/vnd.github+json' } }
    )
    if (!response.ok) {
      return { version, notes: null, url, error: 'Notes indisponibles pour cette version.' }
    }
    const data = (await response.json()) as GithubReleaseResponse
    return { version, notes: data.body?.trim() || null, url }
  } catch (error) {
    return {
      version,
      notes: null,
      url,
      error: error instanceof Error ? error.message : 'Impossible de récupérer les notes.'
    }
  }
}
