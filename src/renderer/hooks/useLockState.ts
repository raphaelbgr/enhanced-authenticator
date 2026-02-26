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

    // Check initial state
    window.api.vaultGetState().then(setAppState).catch(() => setAppState('setup'))

    // If vault doesn't exist, we're in setup
    window.api.vaultExists().then((exists) => {
      if (!exists) setAppState('setup')
    }).catch(() => setAppState('setup'))

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
