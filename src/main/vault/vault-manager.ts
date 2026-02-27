import crypto from 'node:crypto'
import { v4 as uuidv4 } from 'uuid'
import { SecureBuffer } from '../security/secure-memory'
import { deriveKey } from '../security/key-derivation'
import {
  encrypt,
  decrypt,
  serializeVault,
  deserializeVault,
  writeVaultFile,
  readVaultFile,
  getVaultPath
} from '../security/crypto-vault'
import { createEmptyVault, migrateVault } from './vault-schema'
import type { VaultState } from './vault-types'
import type {
  VaultData,
  AccountEntry,
  AccountMeta,
  VaultSettings,
  AppState
} from '../../shared/types'
import { MIN_PASSWORD_LENGTH } from '../../shared/constants'

/**
 * Simple async mutex to serialize all vault state mutations.
 * Prevents races between concurrent IPC handlers, idle timer, API, and tray.
 */
class Mutex {
  private queue: Promise<void> = Promise.resolve()

  async run<T>(fn: () => T | Promise<T>): Promise<T> {
    let release: () => void
    const next = new Promise<void>((resolve) => { release = resolve })
    const prev = this.queue
    this.queue = next
    await prev
    try {
      return await fn()
    } finally {
      release!()
    }
  }
}

class VaultManager {
  private state: VaultState = {
    appState: 'setup',
    vaultPath: getVaultPath(),
    derivedKey: null,
    vaultData: null,
    salt: null
  }

  private mutex = new Mutex()

  get appState(): AppState {
    return this.state.appState
  }

  /** Pure check — no side effects on appState. */
  vaultExists(): boolean {
    const data = readVaultFile(this.state.vaultPath)
    return data !== null
  }

  /** Returns the correct initial state based on vault file existence. */
  getInitialState(): AppState {
    if (this.state.appState === 'unlocked') return 'unlocked'
    return this.vaultExists() ? 'locked' : 'setup'
  }

  async create(password: string): Promise<void> {
    return this.mutex.run(async () => {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      }

      const vault = createEmptyVault()
      vault.apiKey = crypto.randomBytes(32).toString('hex')

      const { key, salt } = await deriveKey(password)
      const plaintext = Buffer.from(JSON.stringify(vault), 'utf-8')
      const { iv, authTag, ciphertext } = encrypt(key, plaintext)
      const serialized = serializeVault(salt, iv, authTag, ciphertext)

      writeVaultFile(this.state.vaultPath, serialized)

      this.state.derivedKey = key
      this.state.vaultData = vault
      this.state.salt = salt
      this.state.appState = 'unlocked'
    })
  }

  async unlock(password: string): Promise<void> {
    return this.mutex.run(async () => {
      const fileData = readVaultFile(this.state.vaultPath)
      if (!fileData) {
        throw new Error('No vault file found')
      }

      const { salt, iv, authTag, ciphertext } = deserializeVault(fileData)
      const { key } = await deriveKey(password, salt)

      let plaintext: Buffer
      try {
        plaintext = decrypt(key, iv, authTag, ciphertext)
      } catch {
        key.wipe()
        throw new Error('Invalid password')
      }

      const vaultData = migrateVault(JSON.parse(plaintext.toString('utf-8')))
      plaintext.fill(0)

      this.state.derivedKey = key
      this.state.vaultData = vaultData
      this.state.salt = salt
      this.state.appState = 'unlocked'
    })
  }

  lock(): void {
    // Synchronous — safe to call from mutex.run or directly
    if (this.state.derivedKey) {
      this.state.derivedKey.wipe()
    }
    this.state.derivedKey = null
    this.state.vaultData = null
    this.state.salt = null
    this.state.appState = 'locked'
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return this.mutex.run(async () => {
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      }
      if (!this.state.vaultData) {
        throw new Error('Vault is not unlocked')
      }

      // Verify old password
      const fileData = readVaultFile(this.state.vaultPath)
      if (!fileData) throw new Error('No vault file found')
      const { salt: oldSalt, iv: oldIv, authTag: oldTag, ciphertext: oldCt } = deserializeVault(fileData)
      const { key: oldKey } = await deriveKey(oldPassword, oldSalt)
      try {
        decrypt(oldKey, oldIv, oldTag, oldCt)
      } catch {
        oldKey.wipe()
        throw new Error('Invalid current password')
      }
      oldKey.wipe()

      // Re-check state after awaits (lock could have happened during key derivation)
      if (!this.state.vaultData) {
        throw new Error('Vault was locked during password change')
      }

      // Re-encrypt with new password
      const { key: newKey, salt: newSalt } = await deriveKey(newPassword)
      const plaintext = Buffer.from(JSON.stringify(this.state.vaultData), 'utf-8')
      const { iv, authTag, ciphertext } = encrypt(newKey, plaintext)
      plaintext.fill(0)
      const serialized = serializeVault(newSalt, iv, authTag, ciphertext)
      writeVaultFile(this.state.vaultPath, serialized)

      if (this.state.derivedKey) {
        this.state.derivedKey.wipe()
      }
      this.state.derivedKey = newKey
      this.state.salt = newSalt
    })
  }

  private save(): void {
    if (!this.state.vaultData || !this.state.derivedKey || !this.state.salt) {
      throw new Error('Vault is not unlocked')
    }

    const plaintext = Buffer.from(JSON.stringify(this.state.vaultData), 'utf-8')
    const { iv, authTag, ciphertext } = encrypt(this.state.derivedKey, plaintext)
    plaintext.fill(0)
    const serialized = serializeVault(this.state.salt, iv, authTag, ciphertext)
    writeVaultFile(this.state.vaultPath, serialized)
  }

  // Account operations

  getAccountsMeta(): AccountMeta[] {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    return this.state.vaultData.accounts.map((a) => a.meta)
  }

  addAccount(entry: AccountEntry): void {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    if (!entry.meta.id) {
      entry.meta.id = uuidv4()
      entry.secret.id = entry.meta.id
    }
    const exists = this.state.vaultData.accounts.some(
      (a) => a.meta.issuer === entry.meta.issuer && a.meta.label === entry.meta.label
    )
    if (exists) {
      throw new Error(`Account already exists: ${entry.meta.issuer} (${entry.meta.label})`)
    }
    this.state.vaultData.accounts.push(entry)
    this.save()
  }

  removeAccount(id: string): void {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    const idx = this.state.vaultData.accounts.findIndex((a) => a.meta.id === id)
    if (idx === -1) throw new Error('Account not found')
    this.state.vaultData.accounts.splice(idx, 1)
    this.save()
  }

  getAccountSecret(id: string): string {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    const account = this.state.vaultData.accounts.find((a) => a.meta.id === id)
    if (!account) throw new Error('Account not found')
    return account.secret.secret
  }

  getAllAccounts(): AccountEntry[] {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    return this.state.vaultData.accounts
  }

  updateAccountMeta(id: string, updates: { issuer?: string; label?: string }): void {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    const account = this.state.vaultData.accounts.find((a) => a.meta.id === id)
    if (!account) throw new Error('Account not found')
    if (updates.issuer !== undefined) account.meta.issuer = updates.issuer
    if (updates.label !== undefined) account.meta.label = updates.label
    this.save()
  }

  reorderAccounts(orderedIds: string[]): void {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    const byId = new Map(this.state.vaultData.accounts.map((a) => [a.meta.id, a]))
    const reordered: AccountEntry[] = []
    for (const id of orderedIds) {
      const entry = byId.get(id)
      if (entry) {
        reordered.push(entry)
        byId.delete(id)
      }
    }
    for (const entry of byId.values()) {
      reordered.push(entry)
    }
    this.state.vaultData.accounts = reordered
    this.save()
  }

  // Settings

  getSettings(): VaultSettings {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    return { ...this.state.vaultData.settings }
  }

  updateSettings(updates: Partial<VaultSettings>): void {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    Object.assign(this.state.vaultData.settings, updates)
    this.save()
  }

  // API key

  getApiKey(): string {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    if (!this.state.vaultData.apiKey) {
      this.state.vaultData.apiKey = crypto.randomBytes(32).toString('hex')
      this.save()
    }
    return this.state.vaultData.apiKey
  }

  regenerateApiKey(): string {
    if (!this.state.vaultData) throw new Error('Vault is not unlocked')
    this.state.vaultData.apiKey = crypto.randomBytes(32).toString('hex')
    this.save()
    return this.state.vaultData.apiKey
  }

  getVaultData(): VaultData | null {
    return this.state.vaultData
  }

  getDerivedKeyHex(): string | null {
    if (!this.state.derivedKey) return null
    return this.state.derivedKey.buffer.toString('hex')
  }

  async unlockWithKey(keyHex: string): Promise<void> {
    return this.mutex.run(async () => {
      const fileData = readVaultFile(this.state.vaultPath)
      if (!fileData) throw new Error('No vault file found')

      const { salt, iv, authTag, ciphertext } = deserializeVault(fileData)
      const key = SecureBuffer.from(Buffer.from(keyHex, 'hex'))

      let plaintext: Buffer
      try {
        plaintext = decrypt(key, iv, authTag, ciphertext)
      } catch {
        key.wipe()
        throw new Error('Invalid key')
      }

      const vaultData = migrateVault(JSON.parse(plaintext.toString('utf-8')))
      plaintext.fill(0)

      this.state.derivedKey = key
      this.state.vaultData = vaultData
      this.state.salt = salt
      this.state.appState = 'unlocked'
    })
  }
}

export const vaultManager = new VaultManager()
