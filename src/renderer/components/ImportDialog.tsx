import React, { useState } from 'react'
import QrScanDialog from './QrScanDialog'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
}

export default function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showQrScan, setShowQrScan] = useState(false)

  // .eav import state
  const [eavFile, setEavFile] = useState<string | null>(null)
  const [eavPassword, setEavPassword] = useState('')
  const [eavLoading, setEavLoading] = useState(false)
  const [eavResult, setEavResult] = useState<string | null>(null)

  if (!open) return null

  const handleImport = async () => {
    if (!input.trim()) return
    setLoading(true)
    setResult(null)

    try {
      let res
      if (input.trim().startsWith('otpauth-migration://')) {
        res = await window.api.accountsImportMigration(input.trim())
      } else if (input.trim().startsWith('otpauth://')) {
        res = await window.api.accountsImportUri(input.trim())
      } else {
        setResult('Invalid input. Paste an otpauth:// or otpauth-migration:// URI.')
        setLoading(false)
        return
      }

      const msg = `Imported ${res.imported} account(s)${res.skipped ? `, skipped ${res.skipped}` : ''}`
      setResult(res.errors.length ? `${msg}. Errors: ${res.errors.join('; ')}` : msg)
      if (res.imported > 0) {
        setInput('')
      }
    } catch (e) {
      setResult((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleEavBrowse = async () => {
    const filePath = await window.api.importVaultPick()
    if (filePath) {
      setEavFile(filePath)
      setEavResult(null)
    }
  }

  const handleEavImport = async () => {
    if (!eavFile || !eavPassword) return
    setEavLoading(true)
    setEavResult(null)
    try {
      const res = await window.api.importVault(eavFile, eavPassword)
      const msg = `Imported ${res.imported} account(s)${res.skipped ? `, skipped ${res.skipped} (duplicates)` : ''}`
      setEavResult(msg)
      if (res.imported > 0) {
        setEavFile(null)
        setEavPassword('')
      }
    } catch (e) {
      setEavResult(`Error: ${(e as Error).message}`)
    } finally {
      setEavLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-1">Import Accounts</h2>
        <p className="text-xs text-slate-400 mb-3">
          Paste one or more <span className="text-slate-300">otpauth://</span> URIs (one per line), or a single{' '}
          <span className="text-slate-300">otpauth-migration://</span> link from Google Authenticator export to bulk import all accounts at once.
        </p>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"otpauth://totp/GitHub:user@example.com?secret=ABC...\notpauth://totp/AWS:admin?secret=XYZ...\n\nor paste an otpauth-migration://offline?data=... link"}
          className="w-full h-28 px-3 py-2 rounded-lg bg-surface border border-slate-600 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent text-sm resize-none font-mono"
          autoFocus
        />

        {result && (
          <p className={`text-sm mt-2 ${result.includes('Error') || result.includes('Invalid') ? 'text-danger' : 'text-success'}`}>
            {result}
          </p>
        )}

        <div className="flex gap-2 mt-3 mb-3">
          <button
            onClick={handleImport}
            disabled={!input.trim() || loading}
            className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-medium transition-colors text-sm"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-xs text-slate-500">or</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* QR Code scan button */}
        <button
          onClick={() => setShowQrScan(true)}
          className="w-full py-2 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors text-sm mb-2"
        >
          Scan QR Code
        </button>

        {/* .eav import section */}
        <div className="bg-surface rounded-xl p-3 mb-3">
          <div className="text-sm font-medium text-slate-300 mb-2">Import Encrypted Backup (.eav)</div>

          <button
            onClick={handleEavBrowse}
            className="w-full py-2 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors text-sm mb-2"
          >
            {eavFile ? eavFile.split(/[/\\]/).pop() : 'Browse for .eav file...'}
          </button>

          {eavFile && (
            <>
              <input
                type="password"
                value={eavPassword}
                onChange={(e) => setEavPassword(e.target.value)}
                placeholder="Export password"
                onKeyDown={(e) => { if (e.key === 'Enter') handleEavImport() }}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent text-sm mb-2"
              />
              <button
                onClick={handleEavImport}
                disabled={!eavPassword || eavLoading}
                className="w-full py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-medium transition-colors text-sm"
              >
                {eavLoading ? 'Decrypting...' : 'Decrypt & Import'}
              </button>
            </>
          )}

          {eavResult && (
            <p className={`text-sm mt-2 ${eavResult.startsWith('Error') ? 'text-danger' : 'text-success'}`}>
              {eavResult}
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-surface-hover transition-colors text-sm"
        >
          Close
        </button>

        <QrScanDialog open={showQrScan} onClose={() => setShowQrScan(false)} />
      </div>
    </div>
  )
}
