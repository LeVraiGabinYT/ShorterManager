import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface OAuthCredentials {
  clientId: string
  clientSecret: string
  authUri: string
  tokenUri: string
}

interface CredentialsFile {
  installed?: RawCredentials
  web?: RawCredentials
}

interface RawCredentials {
  client_id: string
  client_secret: string
  auth_uri: string
  token_uri: string
}

function getCredentialsPath(): string {
  const candidates = [
    join(app.getAppPath(), 'credentials', 'google-oauth.json'),
    join(app.getPath('userData'), 'google-oauth.json')
  ]
  return candidates.find((path) => existsSync(path)) ?? candidates[0]
}

export function loadCredentials(): OAuthCredentials {
  const path = getCredentialsPath()
  if (!existsSync(path)) {
    throw new Error(
      `Fichier d'identifiants OAuth introuvable (attendu dans credentials/google-oauth.json). ${path}`
    )
  }

  const file = JSON.parse(readFileSync(path, 'utf-8')) as CredentialsFile
  const raw = file.installed ?? file.web
  if (!raw) {
    throw new Error("Fichier d'identifiants OAuth invalide : clé 'installed' ou 'web' manquante.")
  }

  return {
    clientId: raw.client_id,
    clientSecret: raw.client_secret,
    authUri: raw.auth_uri,
    tokenUri: raw.token_uri
  }
}
