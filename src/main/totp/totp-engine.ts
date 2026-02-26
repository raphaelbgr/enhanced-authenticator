import * as OTPAuth from 'otpauth'
import type { TotpCode, AccountEntry } from '../../shared/types'

/**
 * Generate a TOTP code for a given account entry.
 */
export function generateCode(entry: AccountEntry): TotpCode {
  const totp = new OTPAuth.TOTP({
    issuer: entry.meta.issuer,
    label: entry.meta.label,
    algorithm: entry.meta.algorithm,
    digits: entry.meta.digits,
    period: entry.meta.period,
    secret: entry.secret.secret
  })

  const code = totp.generate()
  const now = Math.floor(Date.now() / 1000)
  const remaining = entry.meta.period - (now % entry.meta.period)

  return {
    id: entry.meta.id,
    issuer: entry.meta.issuer,
    label: entry.meta.label,
    code,
    remaining,
    period: entry.meta.period
  }
}

/**
 * Generate TOTP codes for all accounts.
 */
export function generateAllCodes(entries: AccountEntry[]): TotpCode[] {
  return entries.map(generateCode)
}
