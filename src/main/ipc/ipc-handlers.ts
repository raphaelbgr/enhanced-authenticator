import { ipcMain, clipboard, BrowserWindow, dialog } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import { vaultManager } from '../vault/vault-manager'
import { generateCode, generateAllCodes } from '../totp/totp-engine'
import { importFromUris, importFromMigration, parseOtpauthUri } from '../totp/import-parser'
import { generateExportQrCodes } from '../totp/qr-generator'
import {
  isBiometricAvailable,
  enableBiometric,
  disableBiometric,
  hasBiometricKey,
  authenticateBiometric
} from '../biometric/biometric-auth'
import { exportVault, importVaultFromFile } from '../export/export-manager'
import type { AccountEntry, ImportResult } from '../../shared/types'

let clipboardTimer: ReturnType<typeof setTimeout> | null = null

export function registerIpcHandlers(): void {
  // Vault
  ipcMain.handle(IPC.VAULT_EXISTS, () => vaultManager.vaultExists())

  ipcMain.handle(IPC.VAULT_CREATE, async (_e, password: string) => {
    await vaultManager.create(password)
  })

  ipcMain.handle(IPC.VAULT_UNLOCK, async (_e, password: string) => {
    await vaultManager.unlock(password)
  })

  ipcMain.handle(IPC.VAULT_LOCK, () => {
    vaultManager.lock()
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.APP_LOCKED)
    }
  })

  ipcMain.handle(IPC.VAULT_CHANGE_PASSWORD, async (_e, oldPw: string, newPw: string) => {
    await vaultManager.changePassword(oldPw, newPw)
  })

  ipcMain.handle(IPC.VAULT_GET_STATE, () => vaultManager.appState)

  // Accounts
  ipcMain.handle(IPC.ACCOUNTS_LIST, () => vaultManager.getAccountsMeta())

  ipcMain.handle(IPC.ACCOUNTS_ADD, (_e, issuer: string, label: string, secret: string) => {
    const { v4: uuidv4 } = require('uuid')
    const id = uuidv4()
    const entry: AccountEntry = {
      meta: {
        id,
        issuer,
        label,
        algorithm: 'SHA1',
        digits: 6,
        period: 30
      },
      secret: { id, secret }
    }
    vaultManager.addAccount(entry)
  })

  ipcMain.handle(IPC.ACCOUNTS_REMOVE, (_e, id: string) => {
    vaultManager.removeAccount(id)
  })

  ipcMain.handle(IPC.ACCOUNTS_IMPORT_URI, (_e, input: string): ImportResult => {
    const lines = input.split('\n').map(l => l.trim()).filter(l => l.startsWith('otpauth://'))
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
    for (const line of lines) {
      try {
        const entry = parseOtpauthUri(line)
        vaultManager.addAccount(entry)
        result.imported++
      } catch (e) {
        result.skipped++
        result.errors.push((e as Error).message)
      }
    }
    return result
  })

  ipcMain.handle(IPC.ACCOUNTS_IMPORT_MIGRATION, (_e, data: string): ImportResult => {
    const result = importFromMigration(data)
    const entries = (result as ImportResult & { _entries: AccountEntry[] })._entries
    let added = 0
    for (const entry of entries) {
      try {
        vaultManager.addAccount(entry)
        added++
      } catch {
        // Duplicate, skip
      }
    }
    return { imported: added, skipped: result.skipped + (entries.length - added), errors: result.errors }
  })

  // TOTP
  ipcMain.handle(IPC.TOTP_GET_CODES, () => {
    const accounts = vaultManager.getAllAccounts()
    return generateAllCodes(accounts)
  })

  ipcMain.handle(IPC.TOTP_GET_CODE, (_e, id: string) => {
    const accounts = vaultManager.getAllAccounts()
    const account = accounts.find((a) => a.meta.id === id)
    if (!account) throw new Error('Account not found')
    return generateCode(account)
  })

  // Clipboard
  ipcMain.handle(IPC.CLIPBOARD_COPY, (_e, text: string) => {
    clipboard.writeText(text)

    // Auto-clear
    if (clipboardTimer) clearTimeout(clipboardTimer)
    const settings = vaultManager.getSettings()
    clipboardTimer = setTimeout(() => {
      if (clipboard.readText() === text) {
        clipboard.clear()
      }
      clipboardTimer = null
    }, settings.clipboardClearMs)
  })

  // Settings
  ipcMain.handle(IPC.SETTINGS_GET, () => vaultManager.getSettings())

  ipcMain.handle(IPC.SETTINGS_UPDATE, (_e, updates: Record<string, unknown>) => {
    vaultManager.updateSettings(updates)
  })

  // API key
  ipcMain.handle(IPC.API_GET_KEY, () => vaultManager.getApiKey())
  ipcMain.handle(IPC.API_REGENERATE_KEY, () => vaultManager.regenerateApiKey())

  // Biometric
  ipcMain.handle(IPC.BIOMETRIC_AVAILABLE, () => isBiometricAvailable() && hasBiometricKey())

  ipcMain.handle(IPC.BIOMETRIC_ENABLE, () => {
    const keyHex = vaultManager.getDerivedKeyHex()
    if (!keyHex) throw new Error('Vault is not unlocked')
    enableBiometric(keyHex)
    vaultManager.updateSettings({ biometricEnabled: true })
  })

  ipcMain.handle(IPC.BIOMETRIC_DISABLE, () => {
    disableBiometric()
    vaultManager.updateSettings({ biometricEnabled: false })
  })

  ipcMain.handle(IPC.BIOMETRIC_UNLOCK, async () => {
    const keyHex = await authenticateBiometric()
    await vaultManager.unlockWithKey(keyHex)
  })

  // Export/Import
  ipcMain.handle(IPC.EXPORT_VAULT, async (_e, password: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'authenticator-backup.eav',
      filters: [{ name: 'Enhanced Authenticator Vault', extensions: ['eav'] }]
    })
    if (result.canceled || !result.filePath) return null
    exportVault(password, result.filePath)
    return result.filePath
  })

  ipcMain.handle(IPC.IMPORT_VAULT, async (_e, filePath: string, password: string) => {
    return importVaultFromFile(filePath, password)
  })

  // QR export
  ipcMain.handle(IPC.ACCOUNTS_EXPORT_QR, async () => {
    const accounts = vaultManager.getAllAccounts()
    return generateExportQrCodes(accounts)
  })

  // QR image decode
  ipcMain.handle(IPC.ACCOUNTS_DECODE_QR_IMAGE, async (_e, filePath: string) => {
    const fs = await import('fs')
    const jsQR = (await import('jsqr')).default
    const { nativeImage } = await import('electron')

    const fileBuffer = fs.readFileSync(filePath)
    const image = nativeImage.createFromBuffer(fileBuffer)
    const size = image.getSize()
    if (size.width === 0 || size.height === 0) {
      throw new Error('Could not load image file')
    }

    const bitmap = image.toBitmap()
    // nativeImage.toBitmap() returns BGRA, jsqr needs RGBA
    const rgba = Buffer.alloc(bitmap.length)
    for (let i = 0; i < bitmap.length; i += 4) {
      rgba[i] = bitmap[i + 2]     // R <- B
      rgba[i + 1] = bitmap[i + 1] // G
      rgba[i + 2] = bitmap[i]     // B <- R
      rgba[i + 3] = bitmap[i + 3] // A
    }

    const code = jsQR(new Uint8ClampedArray(rgba), size.width, size.height)
    if (!code) {
      throw new Error('No QR code found in image')
    }

    return code.data
  })
}
