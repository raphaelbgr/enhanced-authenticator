export interface AccountMeta {
  id: string
  issuer: string
  label: string
  algorithm: 'SHA1' | 'SHA256' | 'SHA512'
  digits: number
  period: number
}

export interface AccountSecret {
  id: string
  secret: string // base32
}

export interface AccountEntry {
  meta: AccountMeta
  secret: AccountSecret
}

export interface VaultData {
  version: number
  accounts: AccountEntry[]
  settings: VaultSettings
  apiKey?: string
}

export interface VaultSettings {
  autoLockMs: number
  clipboardClearMs: number
  biometricEnabled: boolean
  minimizeToTray: boolean
  apiEnabled: boolean
  apiPort: number
  apiListenAll: boolean
}

export type AppState = 'loading' | 'setup' | 'locked' | 'unlocked'

export interface TotpCode {
  id: string
  issuer: string
  label: string
  code: string
  remaining: number
  period: number
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export const DEFAULT_SETTINGS: VaultSettings = {
  autoLockMs: 5 * 60 * 1000,
  clipboardClearMs: 30 * 1000,
  biometricEnabled: false,
  minimizeToTray: true,
  apiEnabled: false,
  apiPort: 29170,
  apiListenAll: false
}
