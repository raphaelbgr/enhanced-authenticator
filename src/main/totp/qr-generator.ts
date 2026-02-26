import QRCode from 'qrcode'
import type { AccountEntry } from '../../shared/types'

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(str: string): Buffer {
  const cleaned = str.replace(/=+$/, '').toUpperCase()
  const bytes: number[] = []
  let bits = 0
  let value = 0

  for (const char of cleaned) {
    const idx = BASE32_CHARS.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

function writeVarint(value: number): Buffer {
  const bytes: number[] = []
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80)
    value >>>= 7
  }
  bytes.push(value & 0x7f)
  return Buffer.from(bytes)
}

function writeTag(fieldNumber: number, wireType: number): Buffer {
  return writeVarint((fieldNumber << 3) | wireType)
}

function writeLengthDelimited(fieldNumber: number, data: Buffer): Buffer {
  const tag = writeTag(fieldNumber, 2)
  const len = writeVarint(data.length)
  return Buffer.concat([tag, len, data])
}

function writeVarintField(fieldNumber: number, value: number): Buffer {
  if (value === 0) return Buffer.alloc(0)
  const tag = writeTag(fieldNumber, 0)
  const val = writeVarint(value)
  return Buffer.concat([tag, val])
}

/**
 * Encode a single OtpParameters message matching Google Authenticator's protobuf schema:
 *   bytes secret = 1;
 *   string name = 2;
 *   string issuer = 3;
 *   int32 algorithm = 4;  // 0=unspec, 1=SHA1, 2=SHA256, 3=SHA512
 *   int32 digits = 5;     // 0=unspec, 1=six, 2=eight
 *   int32 type = 6;       // 0=unspec, 1=HOTP, 2=TOTP
 */
function encodeOtpParameters(account: AccountEntry): Buffer {
  const secretBytes = base32Decode(account.secret.secret)
  const name = account.meta.issuer
    ? `${account.meta.issuer}:${account.meta.label}`
    : account.meta.label

  const algMap: Record<string, number> = { SHA1: 1, SHA256: 2, SHA512: 3 }
  const digitsMap: Record<number, number> = { 6: 1, 8: 2 }

  const parts: Buffer[] = [
    writeLengthDelimited(1, secretBytes),
    writeLengthDelimited(2, Buffer.from(name, 'utf-8')),
    writeLengthDelimited(3, Buffer.from(account.meta.issuer || '', 'utf-8')),
    writeVarintField(4, algMap[account.meta.algorithm] || 1),
    writeVarintField(5, digitsMap[account.meta.digits] || 1),
    writeVarintField(6, 2) // type = TOTP
  ]

  return Buffer.concat(parts.filter((p) => p.length > 0))
}

/**
 * Encode a MigrationPayload protobuf message containing batch info:
 *   repeated OtpParameters otp_parameters = 1;
 *   int32 version = 2;
 *   int32 batch_size = 3;
 *   int32 batch_index = 4;
 *   int32 batch_id = 5;
 */
function encodeProtobufPayload(
  accounts: AccountEntry[],
  batchSize?: number,
  batchIndex?: number,
  batchId?: number
): Buffer {
  const parts: Buffer[] = []

  for (const account of accounts) {
    const otpMsg = encodeOtpParameters(account)
    parts.push(writeLengthDelimited(1, otpMsg))
  }

  // version = 1
  parts.push(writeVarintField(2, 1))

  if (batchSize !== undefined && batchSize > 1) {
    parts.push(writeVarintField(3, batchSize))
    parts.push(writeVarintField(4, batchIndex ?? 0))
    if (batchId !== undefined) {
      parts.push(writeVarintField(5, batchId))
    }
  }

  return Buffer.concat(parts)
}

function splitIntoBatches(accounts: AccountEntry[], batchSize = 10): AccountEntry[][] {
  const batches: AccountEntry[][] = []
  for (let i = 0; i < accounts.length; i += batchSize) {
    batches.push(accounts.slice(i, i + batchSize))
  }
  return batches
}

export interface QrExportBatch {
  dataUrl: string
  batchIndex: number
  batchTotal: number
  accountNames: string[]
}

export async function generateExportQrCodes(accounts: AccountEntry[]): Promise<QrExportBatch[]> {
  if (accounts.length === 0) return []

  const batches = splitIntoBatches(accounts, 10)
  const batchId = Math.floor(Math.random() * 0x7fffffff)
  const results: QrExportBatch[] = []

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const payload = encodeProtobufPayload(batch, batches.length, i, batchId)
    const base64 = payload.toString('base64')
    const uri = `otpauth-migration://offline?data=${encodeURIComponent(base64)}`

    const dataUrl = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 400
    })

    results.push({
      dataUrl,
      batchIndex: i,
      batchTotal: batches.length,
      accountNames: batch.map(
        (a) => (a.meta.issuer ? `${a.meta.issuer}: ${a.meta.label}` : a.meta.label) || 'Unknown'
      )
    })
  }

  return results
}
