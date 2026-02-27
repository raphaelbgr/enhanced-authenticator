<p align="center">
  <img src="resources/icon.png" alt="Enhanced Authenticator" width="128" height="128">
</p>

<h1 align="center">Enhanced Authenticator</h1>

<p align="center">
  A cross-platform TOTP authenticator with encrypted local storage, biometric unlock, QR code support, and a built-in REST API.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/badge/electron-34-47848F?logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/typescript-5-3178C6?logo=typescript" alt="TypeScript">
</p>

<p align="center">
  <img src="resources/hero-screenshot.png" alt="Enhanced Authenticator Screenshot" width="380">
</p>

---

> **Let AI get your 2FA codes** &mdash; Enhanced Authenticator includes a secure REST API
> and CLI designed for LLM agents and automation. Get TOTP codes programmatically
> with API key authentication and rate limiting.

---

## Features

- **Encrypted Vault** &mdash; AES-256-GCM encryption with PBKDF2 key derivation (600k iterations, SHA-512)
- **Biometric Unlock** &mdash; Windows Hello and Touch ID support
- **QR Code Import** &mdash; Scan via camera or upload an image file
- **QR Code Export** &mdash; Batch-aware carousel for Google Authenticator migration
- **Google Authenticator Compatible** &mdash; Full `otpauth-migration://` protobuf support (import & export)
- **System Tray** &mdash; Quick-copy TOTP codes from the tray menu, minimize to tray
- **REST API** &mdash; Localhost API with key authentication and rate limiting
- **CLI Client** &mdash; Command-line access to your TOTP codes
- **Clipboard Auto-Clear** &mdash; Automatically clears copied codes after a configurable timeout
- **Screenshot Protection** &mdash; Optional screen capture prevention
- **Persistent Window Position** &mdash; Remembers window size and position across sessions

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Preview production build
npm start
```

## Import & Export

### Import
- **Paste URI** &mdash; Paste `otpauth://` URIs (one per line) or `otpauth-migration://` links
- **Scan QR Code** &mdash; Use your camera or upload a QR code image

### Export
- **Encrypted Backup** &mdash; Password-protected `.eav` file
- **QR Code** &mdash; Scannable QR codes compatible with Google Authenticator (auto-batched for large vaults)

## REST API

The built-in API runs on `127.0.0.1:29170` when enabled in settings. Toggle "Allow Network Access" to bind to `0.0.0.0` for LAN access.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/status` | No | Health check (running, locked state) |
| GET | `/api/v1/help` | No | Machine-readable command dictionary |
| GET | `/api/v1/accounts` | Yes | List all account metadata |
| GET | `/api/v1/totp/all` | Yes | Get ALL TOTP codes at once |
| GET | `/api/v1/totp/search?q=<query>` | Yes | Search accounts + return codes |
| GET | `/api/v1/totp/:id` | Yes | Get TOTP code by account ID |
| POST | `/api/v1/lock` | Yes | Lock the vault |

```bash
# Health check (no auth)
curl http://127.0.0.1:29170/api/v1/status

# Self-discovery for LLMs (no auth)
curl http://127.0.0.1:29170/api/v1/help

# Get all codes at once
curl -H "Authorization: Bearer YOUR_API_KEY" http://127.0.0.1:29170/api/v1/totp/all

# Search for a specific service
curl -H "Authorization: Bearer YOUR_API_KEY" "http://127.0.0.1:29170/api/v1/totp/search?q=github"

# Get a specific code by ID
curl -H "Authorization: Bearer YOUR_API_KEY" http://127.0.0.1:29170/api/v1/totp/ACCOUNT_ID
```

## CLI

Install globally with `npm link`, then use `ea` from anywhere.

```bash
# Check vault status
ea status

# List all accounts
ea list

# Get a TOTP code (fuzzy match by name)
ea get github

# Get code + copy to clipboard
ea get github --copy

# Get ALL codes at once
ea get-all

# Search accounts
ea search aws

# Lock the vault
ea lock

# LLM-friendly API dictionary
ea help-api

# JSON output for piping
ea list --json
ea get github --json
ea get-all --json
ea search aws --json
```

### Authentication

Priority: `--api-key` flag > `EA_API_KEY` env var > stored config.

```bash
# Inline API key
ea --api-key YOUR_KEY list

# Environment variable
EA_API_KEY=YOUR_KEY ea list

# Store in config (persisted)
ea config set-key YOUR_KEY
ea config set-url http://192.168.1.100:29170
ea config show
```

## LLM / AI Agent Integration

Enhanced Authenticator is designed to be the go-to tool for LLMs and AI agents that need 2FA codes.

### Quick Setup

1. Open Enhanced Authenticator, go to Settings
2. Copy the API key
3. (Optional) Toggle "Allow Network Access" for LAN access

### Self-Discovery

LLMs can discover all available commands without authentication:

```bash
curl http://127.0.0.1:29170/api/v1/help
```

### Example: LLM Getting a Code via curl

```bash
# Get all codes (most common LLM use case)
curl -s -H "Authorization: Bearer YOUR_API_KEY" \
  http://127.0.0.1:29170/api/v1/totp/all | jq '.codes[] | select(.issuer=="GitHub") | .code'

# Search by name
curl -s -H "Authorization: Bearer YOUR_API_KEY" \
  "http://127.0.0.1:29170/api/v1/totp/search?q=github" | jq '.matches[0].code'
```

### Example: LLM Using CLI

```bash
# One-shot with inline auth
ea --api-key YOUR_KEY get github --json

# Get all codes as JSON
ea --api-key YOUR_KEY get-all --json

# Search with env var auth
EA_API_KEY=YOUR_KEY ea search github --json
```

## Architecture

```
src/
  main/           Electron main process
    api/           REST API server
    autolock/      Idle monitoring & auto-lock
    biometric/     Windows Hello / Touch ID
    export/        Encrypted vault export
    ipc/           IPC handlers
    security/      AES-256-GCM, PBKDF2, secure memory
    totp/          TOTP engine, import parser, QR generator
    tray/          System tray integration
    vault/         Vault management
  preload/         Context bridge (sandboxed)
  renderer/        React UI
    components/    UI components
    hooks/         Custom React hooks
    store/         Zustand state management
  shared/          Shared types & constants
cli/               CLI client
```

## Security

- All secrets encrypted at rest with AES-256-GCM
- Key derivation: PBKDF2 with 600,000 iterations and SHA-512
- Sandboxed renderer with context isolation
- No remote code execution; all processing is local
- Automatic vault locking on idle
- Rate-limited API with authentication failure lockout

## License

MIT
