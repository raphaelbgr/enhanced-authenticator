import crypto from 'node:crypto'
import { SecureBuffer } from './secure-memory'
import {
  KDF_ITERATIONS,
  KDF_SALT_BYTES,
  KDF_KEY_BYTES,
  KDF_DIGEST
} from '../../shared/constants'

export interface DerivedKeyResult {
  key: SecureBuffer
  salt: Buffer
}

/**
 * Derive a 256-bit encryption key from a password using PBKDF2-SHA512.
 * Returns the key wrapped in a SecureBuffer and the salt used.
 */
export function deriveKey(
  password: string,
  salt?: Buffer
): Promise<DerivedKeyResult> {
  const useSalt = salt ?? crypto.randomBytes(KDF_SALT_BYTES)

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      useSalt,
      KDF_ITERATIONS,
      KDF_KEY_BYTES,
      KDF_DIGEST,
      (err, derivedKey) => {
        if (err) return reject(err)
        const secureKey = SecureBuffer.from(derivedKey)
        // Wipe the original Buffer returned by pbkdf2
        derivedKey.fill(0)
        resolve({ key: secureKey, salt: useSalt })
      }
    )
  })
}
