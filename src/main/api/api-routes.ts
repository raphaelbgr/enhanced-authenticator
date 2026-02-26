import { Router } from 'express'
import { vaultManager } from '../vault/vault-manager'
import { generateCode, generateAllCodes } from '../totp/totp-engine'
import { apiAuth } from './api-auth'
import { lockController } from '../autolock/lock-controller'

export function createApiRoutes(): Router {
  const router = Router()

  // Health check - no auth required
  router.get('/api/v1/status', (_req, res) => {
    res.json({
      status: 'ok',
      locked: vaultManager.appState !== 'unlocked',
      version: '1.0.0'
    })
  })

  // All routes below require auth
  router.use(apiAuth)

  // List accounts (meta only, no secrets)
  router.get('/api/v1/accounts', (_req, res) => {
    if (vaultManager.appState !== 'unlocked') {
      res.status(503).json({ error: 'Vault is locked' })
      return
    }
    const accounts = vaultManager.getAccountsMeta()
    res.json({ accounts })
  })

  // Get TOTP code for a specific account
  router.get('/api/v1/totp/:id', (req, res) => {
    if (vaultManager.appState !== 'unlocked') {
      res.status(503).json({ error: 'Vault is locked' })
      return
    }
    try {
      const accounts = vaultManager.getAllAccounts()
      const account = accounts.find((a) => a.meta.id === req.params.id)
      if (!account) {
        res.status(404).json({ error: 'Account not found' })
        return
      }
      const code = generateCode(account)
      res.json(code)
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // Lock the vault
  router.post('/api/v1/lock', (_req, res) => {
    lockController.lock()
    res.json({ status: 'locked' })
  })

  return router
}
