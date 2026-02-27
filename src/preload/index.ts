import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'

const api = {
  // Vault
  vaultExists: () => ipcRenderer.invoke(IPC.VAULT_EXISTS),
  vaultCreate: (password: string) => ipcRenderer.invoke(IPC.VAULT_CREATE, password),
  vaultUnlock: (password: string) => ipcRenderer.invoke(IPC.VAULT_UNLOCK, password),
  vaultLock: () => ipcRenderer.invoke(IPC.VAULT_LOCK),
  vaultChangePassword: (oldPw: string, newPw: string) =>
    ipcRenderer.invoke(IPC.VAULT_CHANGE_PASSWORD, oldPw, newPw),
  vaultGetState: () => ipcRenderer.invoke(IPC.VAULT_GET_STATE),
  vaultInitialState: () => ipcRenderer.invoke(IPC.VAULT_INITIAL_STATE),

  // Accounts
  accountsList: () => ipcRenderer.invoke(IPC.ACCOUNTS_LIST),
  accountsAdd: (issuer: string, label: string, secret: string) =>
    ipcRenderer.invoke(IPC.ACCOUNTS_ADD, issuer, label, secret),
  accountsRemove: (id: string) => ipcRenderer.invoke(IPC.ACCOUNTS_REMOVE, id),
  accountsReorder: (orderedIds: string[]) => ipcRenderer.invoke(IPC.ACCOUNTS_REORDER, orderedIds),
  accountsUpdate: (id: string, updates: { issuer?: string; label?: string }) =>
    ipcRenderer.invoke(IPC.ACCOUNTS_UPDATE, id, updates),
  accountsImportUri: (uri: string) => ipcRenderer.invoke(IPC.ACCOUNTS_IMPORT_URI, uri),
  accountsImportMigration: (data: string) =>
    ipcRenderer.invoke(IPC.ACCOUNTS_IMPORT_MIGRATION, data),

  // TOTP
  totpGetCodes: () => ipcRenderer.invoke(IPC.TOTP_GET_CODES),
  totpGetCode: (id: string) => ipcRenderer.invoke(IPC.TOTP_GET_CODE, id),

  // Clipboard
  clipboardCopy: (text: string) => ipcRenderer.invoke(IPC.CLIPBOARD_COPY, text),

  // Settings
  settingsGet: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  settingsUpdate: (updates: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.SETTINGS_UPDATE, updates),

  // Biometric
  biometricAvailable: () => ipcRenderer.invoke(IPC.BIOMETRIC_AVAILABLE),
  biometricEnable: () => ipcRenderer.invoke(IPC.BIOMETRIC_ENABLE),
  biometricDisable: () => ipcRenderer.invoke(IPC.BIOMETRIC_DISABLE),
  biometricUnlock: () => ipcRenderer.invoke(IPC.BIOMETRIC_UNLOCK),

  // API
  apiGetKey: () => ipcRenderer.invoke(IPC.API_GET_KEY),
  apiRegenerateKey: () => ipcRenderer.invoke(IPC.API_REGENERATE_KEY),
  apiGetLanIp: () => ipcRenderer.invoke(IPC.API_GET_LAN_IP),

  // Export/Import
  exportVault: (password: string) => ipcRenderer.invoke(IPC.EXPORT_VAULT, password),
  importVault: (filePath: string, password: string) =>
    ipcRenderer.invoke(IPC.IMPORT_VAULT, filePath, password),
  importVaultPick: () => ipcRenderer.invoke(IPC.IMPORT_VAULT_PICK),

  // QR
  accountsExportQr: () => ipcRenderer.invoke(IPC.ACCOUNTS_EXPORT_QR),
  accountsDecodeQrImage: (filePath: string) =>
    ipcRenderer.invoke(IPC.ACCOUNTS_DECODE_QR_IMAGE, filePath),

  // Events from main process
  onLocked: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC.APP_LOCKED, listener)
    return () => ipcRenderer.removeListener(IPC.APP_LOCKED, listener)
  },
  onUnlocked: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC.APP_UNLOCKED, listener)
    return () => ipcRenderer.removeListener(IPC.APP_UNLOCKED, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
