import { useEffect } from 'react'
import { useAppStore } from '../store/app-store'

export function useLockState() {
  const { appState, setAppState, setCodes, setAccounts } = useAppStore()

  useEffect(() => {
    if (!window.api) {
      console.error('window.api not available - preload script may have failed to load')
      setAppState('setup')
      return
    }

    // Single atomic IPC call — no race between vaultExists and vaultGetState
    window.api.vaultInitialState().then(setAppState).catch(() => setAppState('setup'))

    // Listen for lock/unlock events from main process
    const offLocked = window.api.onLocked(() => {
      setAppState('locked')
      setCodes([])
      setAccounts([])
    })

    const offUnlocked = window.api.onUnlocked(() => {
      setAppState('unlocked')
    })

    return () => {
      offLocked()
      offUnlocked()
    }
  }, [])

  return appState
}
