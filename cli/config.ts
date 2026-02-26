import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CONFIG_DIR = path.join(os.homedir(), '.enhanced-authenticator')
const CONFIG_FILE = path.join(CONFIG_DIR, 'cli-config.json')

interface CliConfig {
  apiKey: string
  apiUrl: string
}

const defaults: CliConfig = {
  apiKey: '',
  apiUrl: 'http://127.0.0.1:29170'
}

export function loadConfig(): CliConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
      return { ...defaults, ...raw }
    }
  } catch {
    // ignore
  }
  return { ...defaults }
}

export function saveConfig(config: Partial<CliConfig>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
  const existing = loadConfig()
  const merged = { ...existing, ...config }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2))
}
