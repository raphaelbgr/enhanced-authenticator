import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { SecureBuffer } from './secure-memory'
import {
  AES_ALGORITHM,
  AES_IV_BYTES,
  AES_AUTH_TAG_BYTES,
  VAULT_MAGIC_STR,
  VAULT_VERSION,
  VAULT_FILENAME,
  KDF_ITERATIONS,
  APP_NAME
} from '../../shared/constants'

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns { iv, authTag, ciphertext }.
 */
export function encrypt(
  key: SecureBuffer,
  plaintext: Buffer
): { iv: Buffer; authTag: Buffer; ciphertext: Buffer } {
  const iv = crypto.randomBytes(AES_IV_BYTES)
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key.buffer, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return { iv, authTag, ciphertext: encrypted }
}

/**
 * Decrypt ciphertext with AES-256-GCM.
 * Returns decrypted Buffer or throws on auth failure.
 */
export function decrypt(
  key: SecureBuffer,
  iv: Buffer,
  authTag: Buffer,
  ciphertext: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key.buffer, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

/**
 * Get the vault file path based on the current platform.
 */
export function getVaultPath(): string {
  let appDataDir: string
  switch (process.platform) {
    case 'win32':
      appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      break
    case 'darwin':
      appDataDir = path.join(os.homedir(), 'Library', 'Application Support')
      break
    default:
      appDataDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  }
  return path.join(appDataDir, APP_NAME, VAULT_FILENAME)
}

/**
 * Serialize vault data into the binary vault file format:
 * [EAV1 magic (4B)][version (1B)][kdf_algo (1B)][iterations (4B)]
 * [salt_len (1B)][salt (32B)][iv_len (1B)][iv (12B)]
 * [auth_tag (16B)][ciphertext_len (4B)][ciphertext]
 */
export function serializeVault(
  salt: Buffer,
  iv: Buffer,
  authTag: Buffer,
  ciphertext: Buffer
): Buffer {
  const header = Buffer.alloc(
    4 + 1 + 1 + 4 + 1 + salt.length + 1 + iv.length + AES_AUTH_TAG_BYTES + 4
  )
  let offset = 0

  // Magic
  Buffer.from(VAULT_MAGIC_STR).copy(header, offset)
  offset += 4

  // Version
  header.writeUInt8(VAULT_VERSION, offset)
  offset += 1

  // KDF algo (0 = PBKDF2-SHA512)
  header.writeUInt8(0, offset)
  offset += 1

  // Iterations
  header.writeUInt32BE(KDF_ITERATIONS, offset)
  offset += 4

  // Salt length + salt
  header.writeUInt8(salt.length, offset)
  offset += 1
  salt.copy(header, offset)
  offset += salt.length

  // IV length + IV
  header.writeUInt8(iv.length, offset)
  offset += 1
  iv.copy(header, offset)
  offset += iv.length

  // Auth tag
  authTag.copy(header, offset)
  offset += AES_AUTH_TAG_BYTES

  // Ciphertext length
  header.writeUInt32BE(ciphertext.length, offset)
  offset += 4

  return Buffer.concat([header, ciphertext])
}

/**
 * Deserialize a vault file buffer into its components.
 */
export function deserializeVault(data: Buffer): {
  version: number
  kdfAlgo: number
  iterations: number
  salt: Buffer
  iv: Buffer
  authTag: Buffer
  ciphertext: Buffer
} {
  let offset = 0

  // Verify magic
  const magic = data.subarray(offset, offset + 4)
  if (!magic.equals(Buffer.from(VAULT_MAGIC_STR))) {
    throw new Error('Invalid vault file: bad magic bytes')
  }
  offset += 4

  const version = data.readUInt8(offset)
  offset += 1

  const kdfAlgo = data.readUInt8(offset)
  offset += 1

  const iterations = data.readUInt32BE(offset)
  offset += 4

  const saltLen = data.readUInt8(offset)
  offset += 1
  const salt = Buffer.from(data.subarray(offset, offset + saltLen))
  offset += saltLen

  const ivLen = data.readUInt8(offset)
  offset += 1
  const iv = Buffer.from(data.subarray(offset, offset + ivLen))
  offset += ivLen

  const authTag = Buffer.from(data.subarray(offset, offset + AES_AUTH_TAG_BYTES))
  offset += AES_AUTH_TAG_BYTES

  const ciphertextLen = data.readUInt32BE(offset)
  offset += 4
  const ciphertext = Buffer.from(data.subarray(offset, offset + ciphertextLen))

  return { version, kdfAlgo, iterations, salt, iv, authTag, ciphertext }
}

/**
 * Write vault file atomically: write to temp, then rename.
 */
export function writeVaultFile(vaultPath: string, data: Buffer): void {
  const dir = path.dirname(vaultPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const tmpPath = vaultPath + '.tmp'
  fs.writeFileSync(tmpPath, data)
  fs.renameSync(tmpPath, vaultPath)
}

/**
 * Read vault file, returns null if it doesn't exist.
 */
export function readVaultFile(vaultPath: string): Buffer | null {
  if (!fs.existsSync(vaultPath)) return null
  return fs.readFileSync(vaultPath)
}
