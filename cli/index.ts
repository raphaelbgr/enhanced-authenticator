#!/usr/bin/env node

import { Command } from 'commander'
import { listAccounts, getCode, getAllCodes, searchCodes, getStatus, getHelp, lockVault } from './api-client'
import { saveConfig, loadConfig } from './config'

const program = new Command()

program
  .name('ea')
  .description('Enhanced Authenticator CLI')
  .version('1.0.0')
  .option('--api-key <key>', 'API key (overrides config and env)')
  .option('--api-url <url>', 'API URL (overrides config and env)')
  .option('--json', 'Output as JSON')

function getOpts() {
  const globalOpts = program.opts()
  return {
    apiKey: globalOpts.apiKey as string | undefined,
    apiUrl: globalOpts.apiUrl as string | undefined
  }
}

function isJson(): boolean {
  return !!program.opts().json
}

program
  .command('status')
  .description('Check vault status')
  .action(async () => {
    try {
      const status = await getStatus(getOpts())
      if (isJson()) {
        console.log(JSON.stringify(status, null, 2))
      } else {
        console.log(`Status: ${status.status}`)
        console.log(`Locked: ${status.locked}`)
        console.log(`Version: ${status.version}`)
      }
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('list')
  .description('List all accounts')
  .action(async () => {
    try {
      const { accounts } = await listAccounts(getOpts())
      if (isJson()) {
        console.log(JSON.stringify(accounts, null, 2))
        return
      }
      if (accounts.length === 0) {
        console.log('No accounts found.')
        return
      }
      for (const acc of accounts) {
        console.log(`  ${acc.issuer} (${acc.label})  [${acc.id}]`)
      }
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('get <name>')
  .description('Get TOTP code for an account (fuzzy match by issuer/label/id)')
  .option('--copy', 'Copy code to clipboard')
  .action(async (name: string, opts: { copy?: boolean }) => {
    try {
      const { accounts } = await listAccounts(getOpts())
      const match = accounts.find(
        (a) =>
          a.issuer.toLowerCase().includes(name.toLowerCase()) ||
          a.label.toLowerCase().includes(name.toLowerCase()) ||
          a.id === name
      )
      if (!match) {
        console.error(`No account matching "${name}"`)
        process.exit(1)
      }

      const result = await getCode(match.id, getOpts())

      if (isJson()) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        const formatted = result.code.length === 6
          ? `${result.code.slice(0, 3)} ${result.code.slice(3)}`
          : result.code
        console.log(`${match.issuer}: ${formatted} (${result.remaining}s remaining)`)
      }

      if (opts.copy) {
        const { execFileSync } = await import('node:child_process')
        if (process.platform === 'win32') {
          execFileSync('cmd', ['/c', 'clip'], { input: result.code, stdio: ['pipe', 'pipe', 'pipe'] })
        } else if (process.platform === 'darwin') {
          execFileSync('pbcopy', [], { input: result.code, stdio: ['pipe', 'pipe', 'pipe'] })
        } else {
          execFileSync('xclip', ['-selection', 'clipboard'], { input: result.code, stdio: ['pipe', 'pipe', 'pipe'] })
        }
        if (!isJson()) console.log('Copied to clipboard!')
      }
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('get-all')
  .description('Get ALL TOTP codes at once')
  .action(async () => {
    try {
      const result = await getAllCodes(getOpts())
      if (isJson()) {
        console.log(JSON.stringify(result, null, 2))
        return
      }
      if (result.codes.length === 0) {
        console.log('No accounts found.')
        return
      }
      for (const code of result.codes) {
        const formatted = code.code.length === 6
          ? `${code.code.slice(0, 3)} ${code.code.slice(3)}`
          : code.code
        console.log(`  ${code.issuer} (${code.label}): ${formatted} (${code.remaining}s remaining)`)
      }
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('search <query>')
  .description('Search accounts by issuer or label and return codes')
  .action(async (query: string) => {
    try {
      const result = await searchCodes(query, getOpts())
      if (isJson()) {
        console.log(JSON.stringify(result, null, 2))
        return
      }
      if (result.matches.length === 0) {
        console.log(`No accounts matching "${query}".`)
        return
      }
      for (const code of result.matches) {
        const formatted = code.code.length === 6
          ? `${code.code.slice(0, 3)} ${code.code.slice(3)}`
          : code.code
        console.log(`  ${code.issuer} (${code.label}): ${formatted} (${code.remaining}s remaining)`)
      }
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('lock')
  .description('Lock the vault')
  .action(async () => {
    try {
      await lockVault(getOpts())
      if (isJson()) {
        console.log(JSON.stringify({ status: 'locked' }))
      } else {
        console.log('Vault locked.')
      }
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('help-api')
  .description('Show LLM-friendly API command dictionary')
  .action(async () => {
    try {
      const help = await getHelp(getOpts())
      console.log(JSON.stringify(help, null, 2))
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
  })

const configCmd = program.command('config').description('CLI configuration')

configCmd
  .command('set-key <key>')
  .description('Set the API key')
  .action((key: string) => {
    saveConfig({ apiKey: key })
    console.log('API key saved.')
  })

configCmd
  .command('set-url <url>')
  .description('Set the API URL')
  .action((url: string) => {
    saveConfig({ apiUrl: url })
    console.log('API URL saved.')
  })

configCmd
  .command('show')
  .description('Show current config')
  .action(() => {
    const config = loadConfig()
    const effectiveKey = process.env.EA_API_KEY || config.apiKey
    const effectiveUrl = process.env.EA_API_URL || config.apiUrl
    if (isJson()) {
      console.log(JSON.stringify({
        apiUrl: effectiveUrl,
        apiKey: effectiveKey ? effectiveKey.slice(0, 8) + '...' : null
      }, null, 2))
    } else {
      console.log(`API URL: ${effectiveUrl}`)
      console.log(`API Key: ${effectiveKey ? effectiveKey.slice(0, 8) + '...' : '(not set)'}`)
    }
  })

program.parse()
