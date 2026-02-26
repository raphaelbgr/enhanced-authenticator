import crypto from 'node:crypto'
import fs from 'node:fs'
import { SecureBuffer } from '../security/secure-memory'
import { deriveKey } from '../security/key-derivation'
import { encrypt, decrypt } from '../security/crypto-vault'
import { vaultManager } from '../vault/vault-manager'
import {
  EXPORT_MAGIC_STR,
  EXPORT_VERSION,
  AES_AUTH_TAG_BYTES,
  MIN_PASSWORD_LENGTH
} from '../../shared/constants'
import type { AccountEntry, ImportResult } from '../../shared/types'

/**
 * Export vault accounts to an encrypted .eav file.
 */
export async function exportVault(password: string, filePath: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  const vaultData = vaultManager.getVaultData()
  if (!vaultData) throw new Error('Vault is not unlocked')

  const payload = JSON.stringify(vaultData.accounts)
  const plaintext = Buffer.from(payload, 'utf-8')

  const { key, salt } = await deriveKey(password)
  const { iv, authTag, ciphertext } = encrypt(key, plaintext)
  key.wipe()
  plaintext.fill(0)

  // Build export file: [EAE1 magic (4B)][version (1B)][salt_len (1B)][salt][iv_len (1B)][iv][auth_tag (16B)][ciphertext_len (4B)][ciphertext]
  const header = Buffer.alloc(4 + 1 + 1 + salt.length + 1 + iv.length + AES_AUTH_TAG_BYTES + 4)
  let offset = 0

  Buffer.from(EXPORT_MAGIC_STR).copy(header, offset); offset += 4
  header.writeUInt8(EXPORT_VERSION, offset); offset += 1
  header.writeUInt8(salt.length, offset); offset += 1
  salt.copy(header, offset); offset += salt.length
  header.writeUInt8(iv.length, offset); offset += 1
  iv.copy(header, offset); offset += iv.length
  authTag.copy(header, offset); offset += AES_AUTH_TAG_BYTES
  header.writeUInt32BE(ciphertext.length, offset); offset += 4

  const fileData = Buffer.concat([header, ciphertext])

  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, fileData)
  fs.renameSync(tmpPath, filePath)
}

/**
 * Import accounts from an encrypted .eav file.
 */
export async function importVaultFromFile(
  filePath: string,
  password: string
): Promise<ImportResult> {
  const data = fs.readFileSync(filePath)
  let offset = 0

  // Verify magic
  const magic = data.subarray(offset, offset + 4)
  if (!magic.equals(Buffer.from(EXPORT_MAGIC_STR))) {
    throw new Error('Invalid export file')
  }
  offset += 4

  const version = data.readUInt8(offset); offset += 1
  if (version !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${version}`)
  }

  const saltLen = data.readUInt8(offset); offset += 1
  const salt = Buffer.from(data.subarray(offset, offset + saltLen)); offset += saltLen

  const ivLen = data.readUInt8(offset); offset += 1
  const iv = Buffer.from(data.subarray(offset, offset + ivLen)); offset += ivLen

  const authTag = Buffer.from(data.subarray(offset, offset + AES_AUTH_TAG_BYTES)); offset += AES_AUTH_TAG_BYTES

  const ciphertextLen = data.readUInt32BE(offset); offset += 4
  const ciphertext = Buffer.from(data.subarray(offset, offset + ciphertextLen))

  const { key } = await deriveKey(password, salt)
  let plaintext: Buffer
  try {
    plaintext = decrypt(key, iv, authTag, ciphertext)
  } catch {
    key.wipe()
    throw new Error('Invalid export password')
  }
  key.wipe()

  const accounts: AccountEntry[] = JSON.parse(plaintext.toString('utf-8'))
  plaintext.fill(0)

  let imported = 0
  let skipped = 0
  for (const entry of accounts) {
    try {
      vaultManager.addAccount(entry)
      imported++
    } catch {
      skipped++
    }
  }

  return { imported, skipped, errors: [] }
}
