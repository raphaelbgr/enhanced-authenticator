import React, { useState } from 'react'
import { MIN_PASSWORD_LENGTH } from '../../shared/constants'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

export default function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  if (!open) return null

  const isValid = password.length >= MIN_PASSWORD_LENGTH && password === confirm

  const handleExport = async () => {
    if (!isValid) return
    setLoading(true)
    setResult(null)
    try {
      const filePath = await window.api.exportVault(password)
      if (filePath) {
        setResult(`Exported to ${filePath}`)
        setPassword('')
        setConfirm('')
      }
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Export Vault</h2>
        <p className="text-sm text-slate-400 mb-4">Create an encrypted backup protected with a separate password.</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Export Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Min ${MIN_PASSWORD_LENGTH} characters`}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-slate-600 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3 py-2 rounded-lg bg-surface border border-slate-600 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent text-sm"
            />
          </div>

          {password && confirm && password !== confirm && (
            <p className="text-sm text-danger">Passwords do not match</p>
          )}

          {result && (
            <p className={`text-sm ${result.startsWith('Error') ? 'text-danger' : 'text-success'}`}>
              {result}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-surface-hover transition-colors text-sm"
          >
            Close
          </button>
          <button
            onClick={handleExport}
            disabled={!isValid || loading}
            className="flex-1 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-medium transition-colors text-sm"
          >
            {loading ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
