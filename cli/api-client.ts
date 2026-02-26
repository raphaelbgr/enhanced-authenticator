import { loadConfig } from './config'

async function request(path: string, method: string = 'GET'): Promise<unknown> {
  const config = loadConfig()
  if (!config.apiKey) {
    throw new Error('API key not configured. Run: ea config set-key <key>')
  }

  const url = `${config.apiUrl}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  }

  return res.json()
}

export async function getStatus(): Promise<{ status: string; locked: boolean; version: string }> {
  const config = loadConfig()
  const res = await fetch(`${config.apiUrl}/api/v1/status`)
  return res.json() as Promise<{ status: string; locked: boolean; version: string }>
}

export async function listAccounts(): Promise<{ accounts: Array<{ id: string; issuer: string; label: string }> }> {
  return request('/api/v1/accounts') as Promise<{ accounts: Array<{ id: string; issuer: string; label: string }> }>
}

export async function getCode(id: string): Promise<{ code: string; remaining: number; period: number }> {
  return request(`/api/v1/totp/${id}`) as Promise<{ code: string; remaining: number; period: number }>
}

export async function lockVault(): Promise<void> {
  await request('/api/v1/lock', 'POST')
}
