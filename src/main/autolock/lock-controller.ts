import { BrowserWindow } from 'electron'
import { vaultManager } from '../vault/vault-manager'
import { IdleMonitor } from './idle-monitor'
import { IPC } from '../../shared/ipc-channels'
import { AUTO_LOCK_DEFAULT_MS } from '../../shared/constants'

/**
 * Controls the lock state of the application.
 * Integrates idle monitoring with vault locking.
 */
export class LockController {
  private idleMonitor: IdleMonitor

  constructor() {
    this.idleMonitor = new IdleMonitor(AUTO_LOCK_DEFAULT_MS, () => this.lock())
  }

  start(): void {
    this.idleMonitor.start()
  }

  stop(): void {
    this.idleMonitor.stop()
  }

  lock(): void {
    if (vaultManager.appState !== 'unlocked') return
    vaultManager.lock()

    // Notify all renderer windows
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.APP_LOCKED)
    }
  }

  updateTimeout(ms: number): void {
    this.idleMonitor.updateThreshold(ms)
  }
}

export const lockController = new LockController()
