export const APP_NAME = 'enhanced-authenticator'
export const VAULT_FILENAME = 'vault.enc'
export const VAULT_MAGIC_STR = 'EAV1'
export const VAULT_VERSION = 1

export const KDF_ITERATIONS = 600_000
export const KDF_SALT_BYTES = 32
export const KDF_KEY_BYTES = 32
export const KDF_DIGEST = 'sha512'

export const AES_IV_BYTES = 12
export const AES_AUTH_TAG_BYTES = 16
export const AES_ALGORITHM = 'aes-256-gcm'

export const TOTP_PERIOD = 30
export const TOTP_DIGITS = 6

export const AUTO_LOCK_DEFAULT_MS = 5 * 60 * 1000
export const IDLE_POLL_INTERVAL_MS = 15 * 1000
export const CLIPBOARD_CLEAR_DELAY_MS = 30 * 1000

export const API_PORT = 29170
export const API_HOST = '127.0.0.1'
export const API_RATE_LIMIT_WINDOW_MS = 60 * 1000
export const API_RATE_LIMIT_MAX = 60
export const API_AUTH_FAIL_WINDOW_MS = 15 * 60 * 1000
export const API_AUTH_FAIL_MAX = 5

export const EXPORT_MAGIC_STR = 'EAE1'
export const EXPORT_VERSION = 1

export const MIN_PASSWORD_LENGTH = 8
