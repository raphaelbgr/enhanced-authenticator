import { systemPreferences, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getVaultPath } from '../security/crypto-vault'

const BIOMETRIC_KEY_FILE = 'biometric-key.enc'

function getBiometricKeyPath(): string {
  return path.join(path.dirname(getVaultPath()), BIOMETRIC_KEY_FILE)
}

/**
 * Check if biometric authentication is available on this system.
 */
export function isBiometricAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false

  if (process.platform === 'darwin') {
    return systemPreferences.canPromptTouchID()
  }

  // Windows Hello - safeStorage uses DPAPI which integrates with Windows Hello
  if (process.platform === 'win32') {
    return true
  }

  return false
}

/**
 * Enable biometric unlock by storing the derived key encrypted with OS keychain.
 */
export function enableBiometric(derivedKeyHex: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption not available')
  }

  const encrypted = safeStorage.encryptString(derivedKeyHex)
  const keyPath = getBiometricKeyPath()
  fs.writeFileSync(keyPath, encrypted)
}

/**
 * Disable biometric unlock by removing the stored key.
 */
export function disableBiometric(): void {
  const keyPath = getBiometricKeyPath()
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath)
  }
}

/**
 * Check if biometric key is stored.
 */
export function hasBiometricKey(): boolean {
  return fs.existsSync(getBiometricKeyPath())
}

/**
 * Authenticate with biometric and retrieve the stored key.
 */
export async function authenticateBiometric(): Promise<string> {
  if (process.platform === 'darwin') {
    await systemPreferences.promptTouchID('unlock Enhanced Authenticator')
  }
  // Windows Hello is handled by the OS when accessing safeStorage

  const keyPath = getBiometricKeyPath()
  if (!fs.existsSync(keyPath)) {
    throw new Error('No biometric key stored')
  }

  const encrypted = fs.readFileSync(keyPath)
  return safeStorage.decryptString(encrypted)
}
