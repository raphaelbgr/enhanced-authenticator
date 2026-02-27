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

  // Machine-readable command dictionary - no auth required
  router.get('/api/v1/help', (_req, res) => {
    res.json({
      name: 'Enhanced Authenticator API',
      version: '1.0.0',
      description: 'Securely retrieve 2FA TOTP codes via authenticated API',
      authentication: 'Bearer token in Authorization header',
      endpoints: [
        {
          method: 'GET',
          path: '/api/v1/status',
          auth: false,
          description: 'Check if vault is running and unlocked',
          response: '{ status, locked, version }'
        },
        {
          method: 'GET',
          path: '/api/v1/help',
          auth: false,
          description: 'Machine-readable command dictionary (this endpoint)',
          response: '{ name, version, description, authentication, endpoints, cli }'
        },
        {
          method: 'GET',
          path: '/api/v1/accounts',
          auth: true,
          description: 'List all account names and IDs',
          response: '{ accounts: [{ id, issuer, label, algorithm, digits, period }] }'
        },
        {
          method: 'GET',
          path: '/api/v1/totp/all',
          auth: true,
          description: 'Get ALL TOTP codes at once',
          response: '{ codes: [{ id, issuer, label, code, remaining, period }], generated_at }'
        },
        {
          method: 'GET',
          path: '/api/v1/totp/search?q=<query>',
          auth: true,
          description: 'Search accounts by issuer or label and return matching codes',
          response: '{ query, matches: [{ id, issuer, label, code, remaining, period }] }'
        },
        {
          method: 'GET',
          path: '/api/v1/totp/:id',
          auth: true,
          description: 'Get TOTP code for a specific account by ID',
          response: '{ id, issuer, label, code, remaining, period }'
        },
        {
          method: 'POST',
          path: '/api/v1/lock',
          auth: true,
          description: 'Lock the vault',
          response: '{ status: "locked" }'
        }
      ],
      cli: {
        binary: 'ea',
        auth: '--api-key <key> or EA_API_KEY env var or ea config set-key <key>',
        commands: [
          'status',
          'list',
          'get <name>',
          'get-all',
          'search <query>',
          'lock',
          'help-api',
          'config set-key <key>',
          'config set-url <url>',
          'config show'
        ]
      }
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

  // Get ALL TOTP codes at once (register before :id to avoid "all" matching as param)
  router.get('/api/v1/totp/all', (_req, res) => {
    if (vaultManager.appState !== 'unlocked') {
      res.status(503).json({ error: 'Vault is locked' })
      return
    }
    try {
      const accounts = vaultManager.getAllAccounts()
      const codes = generateAllCodes(accounts)
      res.json({
        codes,
        generated_at: new Date().toISOString()
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })

  // Search accounts by issuer or label, return matching codes
  router.get('/api/v1/totp/search', (req, res) => {
    if (vaultManager.appState !== 'unlocked') {
      res.status(503).json({ error: 'Vault is locked' })
      return
    }
    const query = (req.query.q as string || '').toLowerCase()
    if (!query) {
      res.status(400).json({ error: 'Missing query parameter: ?q=<search>' })
      return
    }
    try {
      const accounts = vaultManager.getAllAccounts()
      const matching = accounts.filter(
        (a) =>
          a.meta.issuer.toLowerCase().includes(query) ||
          a.meta.label.toLowerCase().includes(query)
      )
      const codes = matching.map((a) => generateCode(a))
      res.json({
        query,
        matches: codes
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
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
