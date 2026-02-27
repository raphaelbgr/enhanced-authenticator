import { loadConfig } from './config'

interface RequestOptions {
  apiKey?: string
  apiUrl?: string
}

function resolveConfig(opts?: RequestOptions) {
  const config = loadConfig()
  return {
    apiKey: opts?.apiKey || process.env.EA_API_KEY || config.apiKey,
    apiUrl: opts?.apiUrl || process.env.EA_API_URL || config.apiUrl
  }
}

async function request(path: string, method: string = 'GET', opts?: RequestOptions): Promise<unknown> {
  const { apiKey, apiUrl } = resolveConfig(opts)
  if (!apiKey) {
    throw new Error('API key not configured. Run: ea config set-key <key>')
  }

  const url = `${apiUrl}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  }

  return res.json()
}

export async function getStatus(opts?: RequestOptions): Promise<{ status: string; locked: boolean; version: string }> {
  const { apiUrl } = resolveConfig(opts)
  let res: Response
  try {
    res = await fetch(`${apiUrl}/api/v1/status`)
  } catch {
    throw new Error('Cannot connect to Enhanced Authenticator. Is the app running?')
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json() as Promise<{ status: string; locked: boolean; version: string }>
}

export async function listAccounts(opts?: RequestOptions): Promise<{ accounts: Array<{ id: string; issuer: string; label: string; algorithm: string; digits: number; period: number }> }> {
  return request('/api/v1/accounts', 'GET', opts) as Promise<{ accounts: Array<{ id: string; issuer: string; label: string; algorithm: string; digits: number; period: number }> }>
}

export async function getCode(id: string, opts?: RequestOptions): Promise<{ id: string; issuer: string; label: string; code: string; remaining: number; period: number }> {
  return request(`/api/v1/totp/${id}`, 'GET', opts) as Promise<{ id: string; issuer: string; label: string; code: string; remaining: number; period: number }>
}

export async function getAllCodes(opts?: RequestOptions): Promise<{ codes: Array<{ id: string; issuer: string; label: string; code: string; remaining: number; period: number }>; generated_at: string }> {
  return request('/api/v1/totp/all', 'GET', opts) as Promise<{ codes: Array<{ id: string; issuer: string; label: string; code: string; remaining: number; period: number }>; generated_at: string }>
}

export async function searchCodes(query: string, opts?: RequestOptions): Promise<{ query: string; matches: Array<{ id: string; issuer: string; label: string; code: string; remaining: number; period: number }> }> {
  return request(`/api/v1/totp/search?q=${encodeURIComponent(query)}`, 'GET', opts) as Promise<{ query: string; matches: Array<{ id: string; issuer: string; label: string; code: string; remaining: number; period: number }> }>
}

export async function getHelp(opts?: RequestOptions): Promise<unknown> {
  const { apiUrl } = resolveConfig(opts)
  let res: Response
  try {
    res = await fetch(`${apiUrl}/api/v1/help`)
  } catch {
    throw new Error('Cannot connect to Enhanced Authenticator. Is the app running?')
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json()
}

export async function lockVault(opts?: RequestOptions): Promise<void> {
  await request('/api/v1/lock', 'POST', opts)
}
