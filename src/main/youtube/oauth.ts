import { shell } from 'electron'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import {
  clearChannelConnection,
  getChannelStatus,
  getStoredTokens,
  saveChannelConnection,
  updateAccessToken
} from '../db/channel'
import { loadCredentials } from './credentials'
import type { ChannelConnectResult } from '../../shared/types'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
].join(' ')

const CONSENT_TIMEOUT_MS = 5 * 60 * 1000

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

function computeExpiry(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString()
}

function waitForAuthorizationCode(redirectPort: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${redirectPort}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(
        error
          ? '<html><body><p>Connexion annulée. Tu peux fermer cet onglet et retourner dans ShorterManager.</p></body></html>'
          : '<html><body><p>Connexion réussie ! Tu peux fermer cet onglet et retourner dans ShorterManager.</p></body></html>'
      )

      clearTimeout(timeout)
      server.close()

      if (error) reject(new Error(error))
      else if (code) resolve(code)
      else reject(new Error('Aucun code renvoyé par Google.'))
    })

    const timeout = setTimeout(() => {
      server.close()
      reject(new Error('Délai de connexion dépassé.'))
    }, CONSENT_TIMEOUT_MS)

    server.listen(redirectPort, '127.0.0.1')
  })
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const credentials = loadCredentials()
  const response = await fetch(credentials.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  })

  if (!response.ok) {
    throw new Error(`Échec de l'échange du code contre un token (${response.status}).`)
  }

  return (await response.json()) as TokenResponse
}

async function fetchOwnChannel(accessToken: string): Promise<{ id: string; title: string }> {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    throw new Error(`Impossible de récupérer la chaîne YouTube (${response.status}).`)
  }

  const data = (await response.json()) as {
    items?: { id: string; snippet: { title: string } }[]
  }
  const channel = data.items?.[0]
  if (!channel) {
    throw new Error('Aucune chaîne YouTube trouvée pour ce compte Google.')
  }

  return { id: channel.id, title: channel.snippet.title }
}

export async function connectChannel(): Promise<ChannelConnectResult> {
  try {
    const credentials = loadCredentials()

    // Bind to port 0 first to let the OS pick a free port, matching the "installed app"
    // loopback exception Google grants regardless of the registered redirect_uris value.
    const probe = createServer()
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve))
    const port = (probe.address() as AddressInfo).port
    await new Promise<void>((resolve) => probe.close(() => resolve()))

    const redirectUri = `http://127.0.0.1:${port}`

    const authUrl = new URL(credentials.authUri)
    authUrl.searchParams.set('client_id', credentials.clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    const codePromise = waitForAuthorizationCode(port)
    await shell.openExternal(authUrl.toString())
    const code = await codePromise

    const tokens = await exchangeCodeForTokens(code, redirectUri)
    if (!tokens.refresh_token) {
      throw new Error(
        "Google n'a renvoyé aucun refresh token. Réessaie la connexion (l'écran de consentement doit apparaître à chaque fois)."
      )
    }

    const channel = await fetchOwnChannel(tokens.access_token)

    saveChannelConnection({
      channelId: channel.id,
      channelTitle: channel.title,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: computeExpiry(tokens.expires_in)
    })

    return { success: true, status: getChannelStatus() }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      status: getChannelStatus()
    }
  }
}

export function disconnectChannel(): void {
  clearChannelConnection()
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = getStoredTokens()
  if (!tokens) {
    throw new Error('Chaîne YouTube non connectée.')
  }

  const expiresInMs = new Date(tokens.tokenExpiry).getTime() - Date.now()
  if (expiresInMs > 60_000) {
    return tokens.accessToken
  }

  const credentials = loadCredentials()
  const response = await fetch(credentials.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokens.refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: 'refresh_token'
    })
  })

  if (!response.ok) {
    throw new Error(`Échec du rafraîchissement du token (${response.status}).`)
  }

  const refreshed = (await response.json()) as TokenResponse
  const tokenExpiry = computeExpiry(refreshed.expires_in)
  updateAccessToken(refreshed.access_token, tokenExpiry)
  return refreshed.access_token
}
