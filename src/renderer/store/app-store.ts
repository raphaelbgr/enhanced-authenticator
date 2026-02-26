import { create } from 'zustand'
import type { AppState, AccountMeta, TotpCode } from '../../shared/types'

interface AppStore {
  appState: AppState
  accounts: AccountMeta[]
  codes: TotpCode[]
  searchQuery: string
  error: string | null

  setAppState: (state: AppState) => void
  setAccounts: (accounts: AccountMeta[]) => void
  setCodes: (codes: TotpCode[]) => void
  setSearchQuery: (query: string) => void
  setError: (error: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  appState: 'setup',
  accounts: [],
  codes: [],
  searchQuery: '',
  error: null,

  setAppState: (appState) => set({ appState }),
  setAccounts: (accounts) => set({ accounts }),
  setCodes: (codes) => set({ codes }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setError: (error) => set({ error })
}))
