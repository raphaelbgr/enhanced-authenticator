#!/usr/bin/env node

import { Command } from 'commander'
import { listAccounts, getCode, getStatus, lockVault } from './api-client'
import { saveConfig, loadConfig } from './config'

const program = new Command()

program
  .name('ea')
  .description('Enhanced Authenticator CLI')
  .version('1.0.0')

program
  .command('list')
  .description('List all accounts')
  .action(async () => {
    try {
      const { accounts } = await listAccounts()
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
  .description('Get TOTP code for an account')
  .option('--copy', 'Copy code to clipboard')
  .action(async (name: string, opts: { copy?: boolean }) => {
    try {
      const { accounts } = await listAccounts()
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

      const result = await getCode(match.id)
      const formatted = result.code.length === 6
        ? `${result.code.slice(0, 3)} ${result.code.slice(3)}`
        : result.code

      console.log(`${match.issuer}: ${formatted} (${result.remaining}s remaining)`)

      if (opts.copy) {
        const { execFileSync } = await import('node:child_process')
        if (process.platform === 'win32') {
          execFileSync('cmd', ['/c', `echo ${result.code}| clip`], { stdio: 'pipe' })
        } else if (process.platform === 'darwin') {
          execFileSync('pbcopy', [], { input: result.code, stdio: ['pipe', 'pipe', 'pipe'] })
        } else {
          execFileSync('xclip', ['-selection', 'clipboard'], { input: result.code, stdio: ['pipe', 'pipe', 'pipe'] })
        }
        console.log('Copied to clipboard!')
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
      await lockVault()
      console.log('Vault locked.')
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Check vault status')
  .action(async () => {
    try {
      const status = await getStatus()
      console.log(`Status: ${status.status}`)
      console.log(`Locked: ${status.locked}`)
      console.log(`Version: ${status.version}`)
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
  .command('show')
  .description('Show current config')
  .action(() => {
    const config = loadConfig()
    console.log(`API URL: ${config.apiUrl}`)
    console.log(`API Key: ${config.apiKey ? config.apiKey.slice(0, 8) + '...' : '(not set)'}`)
  })

program.parse()
