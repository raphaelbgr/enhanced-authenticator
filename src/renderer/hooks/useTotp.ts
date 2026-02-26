import { useEffect, useRef } from 'react'
import { useAppStore } from '../store/app-store'

/**
 * Poll TOTP codes every second when the vault is unlocked.
 */
export function useTotp() {
  const { appState, setCodes } = useAppStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (appState !== 'unlocked') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const fetchCodes = async () => {
      try {
        const codes = await window.api.totpGetCodes()
        setCodes(codes)
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
