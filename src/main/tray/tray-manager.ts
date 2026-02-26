import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { vaultManager } from '../vault/vault-manager'
import { generateAllCodes } from '../totp/totp-engine'
import { lockController } from '../autolock/lock-controller'
import { resetWindowPosition } from '../index'

let tray: Tray | null = null

function resolveTrayIcon(): Electron.NativeImage {
  // Try multiple paths: works in both dev and packaged builds
  const candidates = [
    path.join(__dirname, '../../resources/tray-icon.png'),
    path.join(app.getAppPath(), 'resources/tray-icon.png'),
    path.join(process.resourcesPath || '', 'tray-icon.png')
  ]

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const img = nativeImage.createFromPath(p)
        if (!img.isEmpty()) return img
      }
    } catch {
      // Try next candidate
    }
  }

  return createFallbackIcon()
}

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = resolveTrayIcon()

  tray = new Tray(icon)
  tray.setToolTip('Enhanced Authenticator')

  updateTrayMenu(mainWindow)

  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  return tray
}

function createFallbackIcon(): Electron.NativeImage {
  // 16x16 indigo shield as inline PNG data URI
  const size = 16
  const rgba = new Uint8Array(size * size * 4)
  const cx = 8

  for (let y = 1; y < 15; y++) {
    const t = (y - 1) / 13
    let halfW: number
    if (t < 0.15) {
      halfW = 6 * Math.sqrt(1 - Math.pow((0.15 - t) / 0.15, 2))
    } else if (t < 0.5) {
      halfW = 6
    } else {
      const nt = (t - 0.5) / 0.5
      halfW = 6 * (1 - nt * nt) + 1 * (nt * nt)
    }
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      if (x < 0 || x >= size) continue
      const i = (y * size + x) * 4
      rgba[i] = 99      // R (indigo)
      rgba[i + 1] = 102  // G
      rgba[i + 2] = 241  // B
      rgba[i + 3] = 255  // A
    }
  }

  return nativeImage.createFromBuffer(
    Buffer.from(encodeTinyPNG(size, size, rgba)),
    { width: size, height: size }
  )
}

function encodeTinyPNG(w: number, h: number, rgba: Uint8Array): Buffer {
  const zlib = require('zlib')
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6
  const ihdrC = pngChunk('IHDR', ihdr)

  const raw = Buffer.alloc(h * (1 + w * 4))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4, di = y * (1 + w * 4) + 1 + x * 4
      raw[di] = rgba[si]; raw[di + 1] = rgba[si + 1]
      raw[di + 2] = rgba[si + 2]; raw[di + 3] = rgba[si + 3]
    }
  }
  const idatC = pngChunk('IDAT', zlib.deflateSync(raw))
  const iendC = pngChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdrC, idatC, iendC])
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const body = Buffer.concat([t, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(pngCrc32(body), 0)
  return Buffer.concat([len, t, data, crc])
}

function pngCrc32(buf: Buffer): number {
  const tbl = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    tbl[n] = c
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = tbl[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function updateTrayMenu(mainWindow: BrowserWindow): void {
  if (!tray) return

  const menuItems: Electron.MenuItemConstructorOptions[] = []

  // Add quick-copy items when unlocked
  if (vaultManager.appState === 'unlocked') {
    try {
      const accounts = vaultManager.getAllAccounts()
      const codes = generateAllCodes(accounts)
      const topCodes = codes.slice(0, 10)

      for (const code of topCodes) {
        const formatted = code.code.length === 6
          ? `${code.code.slice(0, 3)} ${code.code.slice(3)}`
          : code.code

        menuItems.push({
          label: `${code.issuer}: ${formatted}`,
          click: () => {
            const { clipboard } = require('electron')
            clipboard.writeText(code.code)
          }
        })
      }

      if (topCodes.length > 0) {
        menuItems.push({ type: 'separator' })
      }
    } catch {
      // Vault might have been locked
    }
  }

  menuItems.push(
    {
      label: vaultManager.appState === 'unlocked' ? 'Lock' : 'Locked',
      enabled: vaultManager.appState === 'unlocked',
      click: () => lockController.lock()
    },
    { type: 'separator' },
    {
      label: mainWindow.isVisible() ? 'Hide' : 'Show',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: 'Reset Position',
      click: () => {
        resetWindowPosition()
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  )

  const contextMenu = Menu.buildFromTemplate(menuItems)
  tray.setContextMenu(contextMenu)
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
