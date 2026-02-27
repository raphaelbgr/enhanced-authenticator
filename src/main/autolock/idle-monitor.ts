import { powerMonitor } from 'electron'
import { IDLE_POLL_INTERVAL_MS } from '../../shared/constants'

type LockCallback = () => void

/**
 * Monitor system idle time and trigger lock after threshold.
 * Only active while the vault is unlocked (controlled by start/stop).
 */
export class IdleMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private thresholdMs: number
  private onIdle: LockCallback
  private unlockedAt: number = 0

  constructor(thresholdMs: number, onIdle: LockCallback) {
    this.thresholdMs = thresholdMs
    this.onIdle = onIdle
  }

  /** Register OS-level events once (call at app startup). */
  registerOsEvents(): void {
    powerMonitor.on('lock-screen', this.onIdle)
    powerMonitor.on('suspend', this.onIdle)
  }

  /** Unregister OS-level events (call at app shutdown). */
  unregisterOsEvents(): void {
    powerMonitor.removeListener('lock-screen', this.onIdle)
    powerMonitor.removeListener('suspend', this.onIdle)
  }

  start(): void {
    if (this.timer) return
    this.unlockedAt = Date.now()

    this.timer = setInterval(() => {
      const idleSeconds = powerMonitor.getSystemIdleTime()
      const idleMs = idleSeconds * 1000
      // Only lock if the idle period started after the vault was unlocked
      const elapsed = Date.now() - this.unlockedAt
      if (idleMs >= this.thresholdMs && elapsed >= this.thresholdMs) {
        this.onIdle()
      }
    }, IDLE_POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  updateThreshold(ms: number): void {
    this.thresholdMs = ms
    this.unlockedAt = Date.now()
  }
}
