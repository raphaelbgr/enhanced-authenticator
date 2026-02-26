import { app, BrowserWindow, Menu, shell, screen } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { registerIpcHandlers } from './ipc/ipc-handlers'
import { enableScreenshotProtection } from './security/screenshot-guard'
import { lockController } from './autolock/lock-controller'
import { startApiServer, stopApiServer } from './api/api-server'
import { createTray, updateTrayMenu, destroyTray } from './tray/tray-manager'
import { vaultManager } from './vault/vault-manager'

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

// ── Window bounds persistence ──

const DEFAULT_BOUNDS = { width: 420, height: 680 }

interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}

function getBoundsPath(): string {
  return path.join(app.getPath('userData'), 'window-bounds.json')
}

function loadBounds(): WindowBounds {
  try {
    const data = fs.readFileSync(getBoundsPath(), 'utf-8')
    const bounds = JSON.parse(data) as WindowBounds

    // Validate saved bounds are on a visible display
    if (bounds.x !== undefined && bounds.y !== undefined) {
      const visible = screen.getAllDisplays().some((d) => {
        const { x, y, width, height } = d.workArea
        return bounds.x! >= x - 100 && bounds.x! < x + width &&
               bounds.y! >= y - 100 && bounds.y! < y + height
      })
      if (!visible) {
        return DEFAULT_BOUNDS
      }
    }

    return bounds
  } catch {
    return DEFAULT_BOUNDS
  }
}

function saveBounds(win: BrowserWindow): void {
  if (win.isMinimized() || win.isMaximized()) return
  try {
    const bounds = win.getBounds()
    fs.writeFileSync(getBoundsPath(), JSON.stringify(bounds))
  } catch {
    // Non-critical, ignore
  }
}

export function resetWindowPosition(): void {
  try { fs.unlinkSync(getBoundsPath()) } catch { /* ignore */ }
  if (mainWindow) {
    mainWindow.setSize(DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height)
    mainWindow.center()
  }
}

function createWindow(): void {
  const bounds = loadBounds()

  // Remove default menu bar
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 360,
    minHeight: 500,
    frame: true,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    }
  })

  // Screenshot protection (disabled during development)
  // enableScreenshotProtection(mainWindow)

  // Prevent navigation to external URLs
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    if (process.env.ELECTRON_RENDERER_URL) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  // Save bounds on move/resize (debounced)
  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  const debounceSaveBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(() => {
      if (mainWindow) saveBounds(mainWindow)
    }, 500)
  }
  mainWindow.on('resize', debounceSaveBounds)
  mainWindow.on('move', debounceSaveBounds)

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (mainWindow && !isQuitting) {
      saveBounds(mainWindow)
      try {
        const settings = vaultManager.getSettings()
        if (settings.minimizeToTray) {
          e.preventDefault()
          mainWindow.hide()
          return
        }
      } catch {
        // Vault might be locked, allow close
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Create system tray
  createTray(mainWindow)

  // Refresh tray menu periodically
  setInterval(() => {
    if (mainWindow) updateTrayMenu(mainWindow)
  }, 5000)
}

let isQuitting = false

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  // Start idle monitoring
  lockController.start()

  // Start API server
  startApiServer()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  lockController.stop()
  stopApiServer()
  destroyTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
