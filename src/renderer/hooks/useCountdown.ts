import { useState, useEffect } from 'react'

/**
 * Returns seconds remaining in the current TOTP period.
 */
export function useCountdown(period: number = 30): number {
  const [remaining, setRemaining] = useState(() => {
    const now = Math.floor(Date.now() / 1000)
    return period - (now % period)
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      setRemaining(period - (now % period))
    }, 200)

    return () => clearInterval(interval)
  }, [period])

  return remaining
}
