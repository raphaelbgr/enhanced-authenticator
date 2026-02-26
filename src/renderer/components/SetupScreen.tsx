import React, { useState } from 'react'
import { useAppStore } from '../store/app-store'
import { MIN_PASSWORD_LENGTH } from '../../shared/constants'

export default function SetupScreen() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAppState, setError } = useAppStore()
  const error = useAppStore((s) => s.error)

  const isValid = password.length >= MIN_PASSWORD_LENGTH && password === confirm

  const handleCreate = async () => {
    if (!isValid) return
    setLoading(true)
    setError(null)
    try {
      await window.api.vaultCreate(password)
      setAppState('unlocked')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) handleCreate()
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen px-8">
      <div className="mb-8 text-center">
        <div className="text-4xl mb-2 font-bold tracking-tight">EA</div>
        <h1 className="text-xl font-semibold text-slate-200">Enhanced Authenticator</h1>
        <p className="text-sm text-slate-400 mt-2">Create a master password to protect your vault</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Master Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Min ${MIN_PASSWORD_LENGTH} characters`}
            className="w-full px-3 py-2.5 rounded-lg bg-surface border border-slate-600 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Re-enter password"
            className="w-full px-3 py-2.5 rounded-lg bg-surface border border-slate-600 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent"
          />
        </div>

        {password && confirm && password !== confirm && (
          <p className="text-sm text-danger">Passwords do not match</p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={!isValid || loading}
          className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {loading ? 'Creating vault...' : 'Create Vault'}
        </button>
      </div>
    </div>
  )
}
