import { BrowserWindow } from 'electron'
import { vaultManager } from '../vault/vault-manager'
import { IdleMonitor } from './idle-monitor'
import { IPC } from '../../shared/ipc-channels'
import { AUTO_LOCK_DEFAULT_MS } from '../../shared/constants'

/**
 * Controls the lock state of the application.
 * Integrates idle monitoring with vault locking.
 * Idle monitoring only runs while the vault is unlocked.
 */
export class LockController {
  private idleMonitor: IdleMonitor
  private ready = false
  private isLocking = false

  constructor() {
    this.idleMonitor = new IdleMonitor(AUTO_LOCK_DEFAULT_MS, () => this.lock())
  }

  /** Call once at app startup to register OS-level events. */
  start(): void {
    this.ready = true
    this.idleMonitor.registerOsEvents()
  }

  /** Call at app shutdown to clean up all listeners and timers. */
  stop(): void {
    this.ready = false
    this.idleMonitor.stop()
    this.idleMonitor.unregisterOsEvents()
  }

  /** Begin idle monitoring (call on vault unlock). */
  activate(timeoutMs: number): void {
    if (!this.ready) return
    this.isLocking = false
    this.idleMonitor.updateThreshold(timeoutMs)
    this.idleMonitor.start()
  }

  /** Lock the vault and stop monitoring. Re-entrancy safe. */
  lock(): void {
    if (this.isLocking) return
    if (vaultManager.appState !== 'unlocked') return
    this.isLocking = true

    vaultManager.lock()
    this.idleMonitor.stop()

    // Notify all renderer windows
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.APP_LOCKED)
    }

    this.isLocking = false
  }

  updateTimeout(ms: number): void {
    this.idleMonitor.updateThreshold(ms)
  }
}

export const lockController = new LockController()
