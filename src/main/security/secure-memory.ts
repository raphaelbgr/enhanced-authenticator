import crypto from 'node:crypto'

/**
 * SecureBuffer wraps a Node.js Buffer allocated outside the V8 heap.
 * On wipe(), performs a 3-pass overwrite: zero → random → zero.
 * Automatically wipes on garbage collection via FinalizationRegistry.
 */
export class SecureBuffer {
  private _buffer: Buffer | null
  private _wiped = false

  private constructor(buf: Buffer) {
    this._buffer = buf
    SecureBuffer._registry.register(this, buf)
  }

  private static _registry = new FinalizationRegistry<Buffer>((buf) => {
    SecureBuffer._wipeBuffer(buf)
  })

  static alloc(size: number): SecureBuffer {
    const buf = Buffer.allocUnsafeSlow(size)
    buf.fill(0)
    return new SecureBuffer(buf)
  }

  static from(data: Buffer | Uint8Array): SecureBuffer {
    const buf = Buffer.allocUnsafeSlow(data.length)
    Buffer.from(data).copy(buf)
    return new SecureBuffer(buf)
  }

  get buffer(): Buffer {
    if (this._wiped || !this._buffer) {
      throw new Error('SecureBuffer has been wiped')
    }
    return this._buffer
  }

  get length(): number {
    return this._buffer?.length ?? 0
  }

  get isWiped(): boolean {
    return this._wiped
  }

  wipe(): void {
    if (this._wiped || !this._buffer) return
    SecureBuffer._wipeBuffer(this._buffer)
    this._wiped = true
    this._buffer = null
  }

  private static _wipeBuffer(buf: Buffer): void {
    // Pass 1: zero
    buf.fill(0)
    // Pass 2: random
    crypto.randomFillSync(buf)
    // Pass 3: zero
    buf.fill(0)
  }
}
