import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { vaultManager } from '../vault/vault-manager'

/**
 * Express middleware for API key authentication using timing-safe comparison.
 */
export function apiAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const providedKey = authHeader.slice(7)

  let storedKey: string
  try {
    storedKey = vaultManager.getApiKey()
  } catch {
    res.status(503).json({ error: 'Vault is locked' })
    return
  }

  const providedBuf = Buffer.from(providedKey, 'utf-8')
  const storedBuf = Buffer.from(storedKey, 'utf-8')

  if (
    providedBuf.length !== storedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, storedBuf)
  ) {
    res.status(401).json({ error: 'Invalid API key' })
    return
  }

  next()
}
