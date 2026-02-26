import type { VaultData } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

/**
 * Migrate vault data from older versions to the current version.
 */
export function migrateVault(data: unknown): VaultData {
  const raw = data as Record<string, unknown>
  const version = (raw.version as number) || 1

  if (version === 1) {
    return data as VaultData
  }

  throw new Error(`Unknown vault version: ${version}`)
}

/**
 * Create a new empty vault data structure.
 */
export function createEmptyVault(): VaultData {
  return {
    version: 1,
    accounts: [],
    settings: { ...DEFAULT_SETTINGS }
  }
}
