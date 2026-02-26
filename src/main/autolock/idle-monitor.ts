import { powerMonitor } from 'electron'
import { IDLE_POLL_INTERVAL_MS } from '../../shared/constants'

type LockCallback = () => void

/**
 * Monitor system idle time and trigger lock after threshold.
 */
export class IdleMonitor {
  private timer: ReturnType<typeof setInterval> | null = null
  private thresholdMs: number
  private onIdle: LockCallback

  constructor(thresholdMs: number, onIdle: LockCallback) {
    this.thresholdMs = thresholdMs
    this.onIdle = onIdle
  }

  start(): void {
    if (this.timer) return

    this.timer = setInterval(() => {
      const idleSeconds = powerMonitor.getSystemIdleTime()
      if (idleSeconds * 1000 >= this.thresholdMs) {
        this.onIdle()
      }
    }, IDLE_POLL_INTERVAL_MS)

    // Lock on OS screen lock and suspend
    powerMonitor.on('lock-screen', this.onIdle)
    powerMonitor.on('suspend', this.onIdle)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    powerMonitor.removeListener('lock-screen', this.onIdle)
    powerMonitor.removeListener('suspend', this.onIdle)
  }

  updateThreshold(ms: number): void {
    this.thresholdMs = ms
  }
}
