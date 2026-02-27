import { create } from 'zustand'
import type { AppState, AccountMeta, TotpCode } from '../../shared/types'

export type SortMode = 'issuer-asc' | 'issuer-desc' | 'label-asc' | 'label-desc' | 'custom'

interface AppStore {
  appState: AppState
  accounts: AccountMeta[]
  codes: TotpCode[]
  searchQuery: string
  sortMode: SortMode
  error: string | null

  setAppState: (state: AppState) => void
  setAccounts: (accounts: AccountMeta[]) => void
  setCodes: (codes: TotpCode[]) => void
  setSearchQuery: (query: string) => void
  setSortMode: (mode: SortMode) => void
  setError: (error: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  appState: 'loading' as AppState,
  accounts: [],
  codes: [],
  searchQuery: '',
  sortMode: 'issuer-asc',
  error: null,

  setAppState: (appState) => set({ appState }),
  setAccounts: (accounts) => set({ accounts }),
  setCodes: (codes) => set({ codes }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortMode: (sortMode) => set({ sortMode }),
  setError: (error) => set({ error })
}))
