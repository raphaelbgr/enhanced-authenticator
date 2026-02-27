import type { AccountMeta, TotpCode, VaultSettings, AppState, ImportResult } from '../shared/types'

declare global {
  interface Window {
    api: {
      // Vault
      vaultExists(): Promise<boolean>
      vaultCreate(password: string): Promise<void>
      vaultUnlock(password: string): Promise<void>
      vaultLock(): Promise<void>
      vaultChangePassword(oldPw: string, newPw: string): Promise<void>
      vaultGetState(): Promise<AppState>
      vaultInitialState(): Promise<AppState>

      // Accounts
      accountsList(): Promise<AccountMeta[]>
      accountsAdd(issuer: string, label: string, secret: string): Promise<void>
      accountsRemove(id: string): Promise<void>
      accountsReorder(orderedIds: string[]): Promise<void>
      accountsUpdate(id: string, updates: { issuer?: string; label?: string }): Promise<void>
      accountsImportUri(uri: string): Promise<ImportResult>
      accountsImportMigration(data: string): Promise<ImportResult>

      // TOTP
      totpGetCodes(): Promise<TotpCode[]>
      totpGetCode(id: string): Promise<TotpCode>

      // Clipboard
      clipboardCopy(text: string): Promise<void>

      // Settings
      settingsGet(): Promise<VaultSettings>
      settingsUpdate(updates: Partial<VaultSettings>): Promise<void>

      // Biometric
      biometricAvailable(): Promise<boolean>
      biometricEnable(): Promise<void>
      biometricDisable(): Promise<void>
      biometricUnlock(): Promise<void>

      // API
      apiGetKey(): Promise<string>
      apiRegenerateKey(): Promise<string>
      apiGetLanIp(): Promise<string>

      // Export/Import
      exportVault(password: string): Promise<string> // returns file path
      importVault(filePath: string, password: string): Promise<ImportResult>
      importVaultPick(): Promise<string | null> // opens file dialog, returns path

      // QR
      accountsExportQr(): Promise<
        { dataUrl: string; batchIndex: number; batchTotal: number; accountNames: string[] }[]
      >
      accountsDecodeQrImage(filePath: string): Promise<string>

      // Events
      onLocked(callback: () => void): () => void
      onUnlocked(callback: () => void): () => void
    }
  }
}

export {}
