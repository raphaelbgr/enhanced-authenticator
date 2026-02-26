import { BrowserWindow } from 'electron'

/**
 * Enable OS-level screenshot protection on a BrowserWindow.
 * Re-applies on show/restore/focus to work around Electron bugs.
 */
export function enableScreenshotProtection(win: BrowserWindow): void {
  win.setContentProtection(true)

  const reapply = () => {
    if (!win.isDestroyed()) {
      win.setContentProtection(true)
    }
  }

  win.on('show', reapply)
  win.on('restore', reapply)
  win.on('focus', reapply)
}
