import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/app-store'

/**
 * Poll TOTP codes every second when the vault is unlocked.
 * Uses a version counter to discard stale IPC responses.
 */
export function useTotp() {
  const { appState, setCodes } = useAppStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const versionRef = useRef(0)

  useEffect(() => {
    if (appState !== 'unlocked') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // Bump version to invalidate any in-flight IPC responses
      versionRef.current++
      return
    }

    const version = ++versionRef.current

    const fetchCodes = async () => {
      try {
        const codes = await window.api.totpGetCodes()
        // Only update if this effect is still the active one
        if (versionRef.current === version) {
          setCodes(codes)
        }
      } catch {
        // Vault may have been locked
      }
    }

    fetchCodes()
    intervalRef.current = setInterval(fetchCodes, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [appState])
}
