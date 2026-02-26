import * as OTPAuth from 'otpauth'
import { v4 as uuidv4 } from 'uuid'
import type { AccountEntry, ImportResult } from '../../shared/types'

/**
 * Parse an otpauth:// URI into an AccountEntry.
 */
export function parseOtpauthUri(uri: string): AccountEntry {
  const totp = OTPAuth.URI.parse(uri)
  if (!(totp instanceof OTPAuth.TOTP)) {
    throw new Error('Only TOTP accounts are supported')
  }

  const id = uuidv4()
  return {
    meta: {
      id,
      issuer: totp.issuer || 'Unknown',
      label: totp.label || '',
      algorithm: totp.algorithm as 'SHA1' | 'SHA256' | 'SHA512',
      digits: totp.digits,
      period: totp.period
    },
    secret: {
      id,
      secret: totp.secret.base32
    }
  }
}

/**
 * Parse one or more otpauth:// URIs (newline-separated).
 */
export function importFromUris(input: string): ImportResult {
  const lines = input
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('otpauth://'))

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  const entries: AccountEntry[] = []

  for (const line of lines) {
    try {
      const entry = parseOtpauthUri(line)
      entries.push(entry)
      result.imported++
    } catch (e) {
      result.errors.push(`Failed to parse: ${line.substring(0, 50)}... - ${(e as Error).message}`)
      result.skipped++
    }
  }

  return { ...result, _entries: entries } as ImportResult & { _entries: AccountEntry[] }
}

/**
 * Decode a Google Authenticator migration payload (otpauth-migration://).
 * The data parameter is the base64-encoded protobuf payload.
 *
 * The protobuf schema (simplified):
 * message MigrationPayload {
 *   repeated OtpParameters otp_parameters = 1;
 * }
 * message OtpParameters {
 *   bytes secret = 1;
 *   string name = 2;
 *   string issuer = 3;
 *   int32 algorithm = 4;  // 0=unspec, 1=SHA1, 2=SHA256, 3=SHA512
 *   int32 digits = 5;     // 0=unspec, 1=six, 2=eight
 *   int32 type = 6;       // 0=unspec, 1=HOTP, 2=TOTP
 * }
 */
export function importFromMigration(input: string): ImportResult & { _entries: AccountEntry[] } {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  const entries: AccountEntry[] = []

  try {
    // Extract base64 payload from URI
    let base64Data: string
    if (input.startsWith('otpauth-migration://offline?data=')) {
      base64Data = decodeURIComponent(input.split('data=')[1])
    } else {
      base64Data = input
    }

    const payload = Buffer.from(base64Data, 'base64')

    // Manual protobuf decoding (field 1 = repeated OtpParameters)
    const otpEntries = decodeProtobufPayload(payload)

    for (const otp of otpEntries) {
      if (otp.type !== 2) {
        // Skip non-TOTP entries
        result.skipped++
        continue
      }

      const id = uuidv4()
      const algMap: Record<number, 'SHA1' | 'SHA256' | 'SHA512'> = {
        0: 'SHA1',
        1: 'SHA1',
        2: 'SHA256',
        3: 'SHA512'
      }
      const digitsMap: Record<number, number> = { 0: 6, 1: 6, 2: 8 }

      // Parse name: "issuer:label" or just "label"
      let issuer = otp.issuer || ''
      let label = otp.name || ''
      if (label.includes(':')) {
        const parts = label.split(':')
        if (!issuer) issuer = parts[0].trim()
        label = parts.slice(1).join(':').trim()
      }

      entries.push({
        meta: {
          id,
          issuer: issuer || 'Unknown',
          label,
          algorithm: algMap[otp.algorithm] || 'SHA1',
          digits: digitsMap[otp.digits] || 6,
          period: 30
        },
        secret: {
          id,
          secret: base32Encode(otp.secret)
        }
      })
      result.imported++
    }
  } catch (e) {
    result.errors.push(`Migration parse error: ${(e as Error).message}`)
  }

  return { ...result, _entries: entries }
}

// Minimal protobuf decoder for Google Auth migration format
interface OtpParam {
  secret: Buffer
  name: string
  issuer: string
  algorithm: number
  digits: number
  type: number
}

function decodeProtobufPayload(buf: Buffer): OtpParam[] {
  const entries: OtpParam[] = []
  let pos = 0

  while (pos < buf.length) {
    const tag = readVarint(buf, pos)
    pos = tag.newPos
    const fieldNumber = tag.value >> 3
    const wireType = tag.value & 0x7

    if (fieldNumber === 1 && wireType === 2) {
      // Length-delimited: OtpParameters message
      const len = readVarint(buf, pos)
      pos = len.newPos
      const msgBuf = buf.subarray(pos, pos + len.value)
      pos += len.value
      entries.push(decodeOtpParameters(msgBuf))
    } else {
      // Skip unknown field
      pos = skipField(buf, pos, wireType)
    }
  }

  return entries
}

function decodeOtpParameters(buf: Buffer): OtpParam {
  const otp: OtpParam = {
    secret: Buffer.alloc(0),
    name: '',
    issuer: '',
    algorithm: 0,
    digits: 0,
    type: 0
  }

  let pos = 0
  while (pos < buf.length) {
    const tag = readVarint(buf, pos)
    pos = tag.newPos
    const fieldNumber = tag.value >> 3
    const wireType = tag.value & 0x7

    if (wireType === 2) {
      const len = readVarint(buf, pos)
      pos = len.newPos
      const data = buf.subarray(pos, pos + len.value)
      pos += len.value
      if (fieldNumber === 1) otp.secret = Buffer.from(data)
      else if (fieldNumber === 2) otp.name = data.toString('utf-8')
      else if (fieldNumber === 3) otp.issuer = data.toString('utf-8')
    } else if (wireType === 0) {
      const val = readVarint(buf, pos)
      pos = val.newPos
      if (fieldNumber === 4) otp.algorithm = val.value
      else if (fieldNumber === 5) otp.digits = val.value
      else if (fieldNumber === 6) otp.type = val.value
    } else {
      pos = skipField(buf, pos, wireType)
    }
  }

  return otp
}

function readVarint(buf: Buffer, pos: number): { value: number; newPos: number } {
  let value = 0
  let shift = 0
  let b: number
  do {
    b = buf[pos++]
    value |= (b & 0x7f) << shift
    shift += 7
  } while (b & 0x80)
  return { value, newPos: pos }
}

function skipField(buf: Buffer, pos: number, wireType: number): number {
  switch (wireType) {
    case 0: return readVarint(buf, pos).newPos
    case 1: return pos + 8
    case 2: {
      const len = readVarint(buf, pos)
      return len.newPos + len.value
    }
    case 5: return pos + 4
    default: throw new Error(`Unknown wire type: ${wireType}`)
  }
}

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf: Buffer): string {
  let result = ''
  let bits = 0
  let value = 0

  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }

  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 0x1f]
  }

  return result
}
