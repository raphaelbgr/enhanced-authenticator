/**
 * Generate tray and app icons for Enhanced Authenticator.
 * Creates a shield icon with a lock/keyhole symbol.
 * No external dependencies — uses raw PNG encoding.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const RESOURCES = path.join(__dirname, '..', 'resources')

// ── PNG encoder (minimal, no deps) ──

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr)

  // IDAT
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4
      const di = y * (1 + width * 4) + 1 + x * 4
      raw[di] = rgba[si]
      raw[di + 1] = rgba[si + 1]
      raw[di + 2] = rgba[si + 2]
      raw[di + 3] = rgba[si + 3]
    }
  }
  const compressed = zlib.deflateSync(raw)
  const idatChunk = makeChunk('IDAT', compressed)

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeB = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeB, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcData), 0)
  return Buffer.concat([len, typeB, data, crc])
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  }
  CRC_TABLE[n] = c
}

// ── Icon drawing ──

function drawIcon(size) {
  const rgba = new Uint8Array(size * size * 4)

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    // Alpha blend
    const srcA = a / 255
    const dstA = rgba[i + 3] / 255
    const outA = srcA + dstA * (1 - srcA)
    if (outA > 0) {
      rgba[i]     = Math.round((r * srcA + rgba[i] * dstA * (1 - srcA)) / outA)
      rgba[i + 1] = Math.round((g * srcA + rgba[i + 1] * dstA * (1 - srcA)) / outA)
      rgba[i + 2] = Math.round((b * srcA + rgba[i + 2] * dstA * (1 - srcA)) / outA)
      rgba[i + 3] = Math.round(outA * 255)
    }
  }

  function fillCircle(cx, cy, r, red, green, blue, alpha = 255) {
    const r2 = r * r
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx
        const dy = y - cy
        const d2 = dx * dx + dy * dy
        if (d2 <= r2) {
          // Anti-alias at edge
          const edge = r - Math.sqrt(d2)
          const a = edge < 1 ? Math.round(alpha * edge) : alpha
          if (a > 0) setPixel(x, y, red, green, blue, a)
        }
      }
    }
  }

  function fillRect(x1, y1, x2, y2, r, g, b, a = 255) {
    for (let y = Math.round(y1); y < Math.round(y2); y++) {
      for (let x = Math.round(x1); x < Math.round(x2); x++) {
        setPixel(x, y, r, g, b, a)
      }
    }
  }

  const s = size / 32 // scale factor relative to 32x32 base

  // Shield shape - filled with a gradient-like accent color
  // Main shield body (rounded rectangle bottom)
  const shieldColor = { r: 99, g: 102, b: 241 } // indigo-500 (accent)
  const shieldDark  = { r: 79, g: 70,  b: 229 } // indigo-600

  // Draw shield outline shape
  const cx = size / 2
  const shieldTop = 2 * s
  const shieldBot = 28 * s
  const shieldW = 12 * s // half-width at top
  const shieldNarrow = 2 * s // half-width at bottom point

  for (let y = Math.round(shieldTop); y < Math.round(shieldBot); y++) {
    const t = (y - shieldTop) / (shieldBot - shieldTop)
    let halfW

    if (t < 0.15) {
      // Top rounded part
      halfW = shieldW * Math.sqrt(1 - Math.pow((0.15 - t) / 0.15, 2))
    } else if (t < 0.55) {
      // Straight sides
      halfW = shieldW
    } else {
      // Narrowing to point
      const nt = (t - 0.55) / 0.45
      halfW = shieldW * (1 - nt) + shieldNarrow * nt
      // Make it curve in nicely
      halfW = shieldW * (1 - nt * nt) + shieldNarrow * (nt * nt)
    }

    // Color gradient: lighter at top, darker at bottom
    const gr = Math.round(shieldColor.r * (1 - t * 0.25) + shieldDark.r * (t * 0.25))
    const gg = Math.round(shieldColor.g * (1 - t * 0.25) + shieldDark.g * (t * 0.25))
    const gb = Math.round(shieldColor.b * (1 - t * 0.25) + shieldDark.b * (t * 0.25))

    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      // Anti-alias edges
      const edgeL = (x - (cx - halfW))
      const edgeR = ((cx + halfW) - x)
      const edge = Math.min(edgeL, edgeR)
      const a = edge < 1 ? Math.max(0, Math.round(255 * edge)) : 255
      setPixel(x, y, gr, gg, gb, a)
    }
  }

  // Draw a lock/keyhole symbol in white
  const lockCx = cx
  const lockCy = 14 * s

  // Lock body (rectangle)
  const lockW = 5 * s
  const lockH = 5.5 * s
  const lockTop = lockCy - 0.5 * s
  fillRect(lockCx - lockW / 2, lockTop, lockCx + lockW / 2, lockTop + lockH, 255, 255, 255)

  // Lock shackle (arc on top)
  const shackleR = 3 * s
  const shackleThick = 1.2 * s
  for (let angle = 0; angle <= Math.PI; angle += 0.02) {
    const ax = lockCx + Math.cos(angle + Math.PI) * shackleR
    const ay = lockCy - 1 * s + Math.sin(angle + Math.PI) * shackleR
    fillCircle(ax, ay, shackleThick / 2, 255, 255, 255)
  }

  // Keyhole (dark circle + slit)
  fillCircle(lockCx, lockTop + 2 * s, 1.2 * s, shieldDark.r, shieldDark.g, shieldDark.b)
  fillRect(lockCx - 0.6 * s, lockTop + 2.5 * s, lockCx + 0.6 * s, lockTop + lockH - 0.8 * s,
    shieldDark.r, shieldDark.g, shieldDark.b)

  return Buffer.from(rgba)
}

// ── ICO encoder ──

function encodeICO(pngBuffers) {
  // ICO header: 6 bytes
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)     // reserved
  header.writeUInt16LE(1, 2)     // type: icon
  header.writeUInt16LE(pngBuffers.length, 4) // count

  const entries = []
  let offset = 6 + pngBuffers.length * 16 // header + entries

  for (const { size, png } of pngBuffers) {
    const entry = Buffer.alloc(16)
    entry[0] = size === 256 ? 0 : size // width
    entry[1] = size === 256 ? 0 : size // height
    entry[2] = 0   // color palette
    entry[3] = 0   // reserved
    entry.writeUInt16LE(1, 4)   // color planes
    entry.writeUInt16LE(32, 6)  // bits per pixel
    entry.writeUInt32LE(png.length, 8) // data size
    entry.writeUInt32LE(offset, 12)    // data offset
    entries.push(entry)
    offset += png.length
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map(p => p.png)])
}

// ── Main ──

if (!fs.existsSync(RESOURCES)) {
  fs.mkdirSync(RESOURCES, { recursive: true })
}

// Generate icons at multiple sizes
const sizes = [16, 32, 48, 64, 128, 256]
const pngBuffers = []

for (const size of sizes) {
  const rgba = drawIcon(size)
  const png = encodePNG(size, size, rgba)
  pngBuffers.push({ size, png })

  if (size === 32) {
    // Tray icon (32x32)
    fs.writeFileSync(path.join(RESOURCES, 'tray-icon.png'), png)
    console.log(`Created tray-icon.png (${size}x${size})`)
  }

  if (size === 256) {
    // App icon PNG
    fs.writeFileSync(path.join(RESOURCES, 'icon.png'), png)
    console.log(`Created icon.png (${size}x${size})`)
  }
}

// Create ICO (Windows)
const ico = encodeICO(pngBuffers)
fs.writeFileSync(path.join(RESOURCES, 'icon.ico'), ico)
console.log(`Created icon.ico (${sizes.join(', ')}px)`)

console.log('Done! Icons saved to resources/')
