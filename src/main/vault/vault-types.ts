import type { VaultData, AppState } from '../../shared/types'
import type { SecureBuffer } from '../security/secure-memory'

export interface VaultState {
  appState: AppState
  vaultPath: string
  derivedKey: SecureBuffer | null
  vaultData: VaultData | null
  salt: Buffer | null
}
