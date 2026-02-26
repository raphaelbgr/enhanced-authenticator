export const IPC = {
  // Vault
  VAULT_EXISTS: 'vault:exists',
  VAULT_CREATE: 'vault:create',
  VAULT_UNLOCK: 'vault:unlock',
  VAULT_LOCK: 'vault:lock',
  VAULT_CHANGE_PASSWORD: 'vault:change-password',
  VAULT_GET_STATE: 'vault:get-state',

  // Accounts
  ACCOUNTS_LIST: 'accounts:list',
  ACCOUNTS_ADD: 'accounts:add',
  ACCOUNTS_REMOVE: 'accounts:remove',
  ACCOUNTS_IMPORT_URI: 'accounts:import-uri',
  ACCOUNTS_IMPORT_MIGRATION: 'accounts:import-migration',

  // TOTP
  TOTP_GET_CODES: 'totp:get-codes',
  TOTP_GET_CODE: 'totp:get-code',

  // Clipboard
  CLIPBOARD_COPY: 'clipboard:copy',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Biometric
  BIOMETRIC_AVAILABLE: 'biometric:available',
  BIOMETRIC_ENABLE: 'biometric:enable',
  BIOMETRIC_DISABLE: 'biometric:disable',
  BIOMETRIC_UNLOCK: 'biometric:unlock',

  // API
  API_GET_KEY: 'api:get-key',
  API_REGENERATE_KEY: 'api:regenerate-key',

  // Export
  EXPORT_VAULT: 'export:vault',
  IMPORT_VAULT: 'import:vault',

  // QR
  ACCOUNTS_EXPORT_QR: 'accounts:export-qr',
  ACCOUNTS_DECODE_QR_IMAGE: 'accounts:decode-qr-image',

  // App events (main → renderer)
  APP_LOCKED: 'app:locked',
  APP_UNLOCKED: 'app:unlocked'
} as const
