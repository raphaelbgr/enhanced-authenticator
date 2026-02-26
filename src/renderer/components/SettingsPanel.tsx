import React, { useEffect, useState } from 'react'
import type { VaultSettings } from '../../shared/types'
import ExportDialog from './ExportDialog'
import QrExportDialog from './QrExportDialog'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<VaultSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showQrExport, setShowQrExport] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)

  // Change password state
  const [showChangePw, setShowChangePw] = useState(false)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMessage, setPwMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    window.api.settingsGet().then(setSettings)
    window.api.apiGetKey().then(setApiKey)
    window.api.biometricAvailable().then(setBiometricAvailable)
  }, [open])

  if (!open || !settings) return null

  const updateSetting = async (key: keyof VaultSettings, value: unknown) => {
    const updates = { [key]: value }
    await window.api.settingsUpdate(updates)
    setSettings((prev) => prev ? { ...prev, ...updates } : prev)
  }

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      setPwMessage('Passwords do not match')
      return
    }
    try {
      await window.api.vaultChangePassword(oldPw, newPw)
      setPwMessage('Password changed successfully')
      setOldPw('')
      setNewPw('')
      setConfirmPw('')
      setShowChangePw(false)
    } catch (e) {
      setPwMessage((e as Error).message)
    }
  }

  const handleRegenerateApiKey = async () => {
    const key = await window.api.apiRegenerateKey()
    setApiKey(key)
  }

  const autoLockMinutes = Math.round(settings.autoLockMs / 60000)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-slate-800 rounded-t-2xl w-full max-w-md max-h-[85vh] overflow-y-auto border-t border-slate-700">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-200">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Auto-lock */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Auto-lock after {autoLockMinutes < 60
                ? `${autoLockMinutes} minute${autoLockMinutes !== 1 ? 's' : ''}`
                : autoLockMinutes < 1440
                  ? `${Math.round(autoLockMinutes / 60)} hour${Math.round(autoLockMinutes / 60) !== 1 ? 's' : ''}`
                  : `${Math.round(autoLockMinutes / 1440)} day${Math.round(autoLockMinutes / 1440) !== 1 ? 's' : ''}`}
            </label>
            <input
              type="range"
              min={1}
              max={10080}
              step={1}
              value={autoLockMinutes}
              onChange={(e) => updateSetting('autoLockMs', Number(e.target.value) * 60000)}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1 min</span>
              <span>7 days</span>
            </div>
          </div>

          {/* Biometric */}
          {biometricAvailable && (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-300">Biometric Unlock</div>
                <div className="text-xs text-slate-500">Windows Hello / Touch ID</div>
              </div>
              <button
                onClick={() => {
                  if (settings.biometricEnabled) {
                    window.api.biometricDisable()
                    updateSetting('biometricEnabled', false)
                  } else {
                    window.api.biometricEnable()
                    updateSetting('biometricEnabled', true)
                  }
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.biometricEnabled ? 'bg-accent' : 'bg-slate-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    settings.biometricEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Minimize to tray */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-300">Minimize to Tray</div>
              <div className="text-xs text-slate-500">Keep running in background</div>
            </div>
            <button
              onClick={() => updateSetting('minimizeToTray', !settings.minimizeToTray)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.minimizeToTray ? 'bg-accent' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.minimizeToTray ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* API Key */}
          <div>
            <div className="text-sm font-medium text-slate-300 mb-2">API Key</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-2 py-1.5 rounded bg-surface text-xs text-slate-400 font-mono truncate">
                {showApiKey ? apiKey : apiKey.slice(0, 8) + '...'}
              </code>
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-2 py-1.5 rounded bg-surface hover:bg-surface-hover text-xs text-slate-400"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={handleRegenerateApiKey}
                className="px-2 py-1.5 rounded bg-surface hover:bg-surface-hover text-xs text-slate-400"
              >
                Regenerate
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div>
            <button
              onClick={() => setShowChangePw(!showChangePw)}
              className="text-sm text-accent hover:text-accent-hover"
            >
              Change Master Password
            </button>

            {showChangePw && (
              <div className="mt-3 space-y-2">
                <input
                  type="password"
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                  placeholder="Current password"
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-slate-600 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent text-sm"
                />
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="New password"
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-slate-600 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent text-sm"
                />
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-slate-600 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent text-sm"
                />
                {pwMessage && (
                  <p className={`text-xs ${pwMessage.includes('success') ? 'text-success' : 'text-danger'}`}>
                    {pwMessage}
                  </p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={!oldPw || !newPw || !confirmPw}
                  className="w-full py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  Change Password
                </button>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="space-y-2">
            <button
              onClick={() => setShowExport(true)}
              className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-surface-hover transition-colors text-sm"
            >
              Export Encrypted Backup
            </button>
            <button
              onClick={() => setShowQrExport(true)}
              className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-surface-hover transition-colors text-sm"
            >
              Export as QR Code
            </button>
          </div>
        </div>

        <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
        <QrExportDialog open={showQrExport} onClose={() => setShowQrExport(false)} />
      </div>
    </div>
  )
}
