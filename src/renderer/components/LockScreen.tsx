import React, { useState } from 'react'
import { useAppStore } from '../store/app-store'

export default function LockScreen() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAppState, setError } = useAppStore()
  const error = useAppStore((s) => s.error)

  const handleUnlock = async () => {
    if (!password) return
    setLoading(true)
    setError(null)
    try {
      await window.api.vaultUnlock(password)
      setAppState('unlocked')
      setPassword('')
    } catch (e) {
      setError((e as Error).message)
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock()
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen px-8">
      <div className="mb-8 text-center">
        <div className="text-4xl mb-2">
          <svg className="w-12 h-12 mx-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-slate-200">Vault Locked</h1>
        <p className="text-sm text-slate-400 mt-1">Enter your master password</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Master password"
          className="w-full px-3 py-2.5 rounded-lg bg-surface border border-slate-600 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-accent"
          autoFocus
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={!password || loading}
          className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors"
        >
          {loading ? 'Unlocking...' : 'Unlock'}
        </button>
      </div>
    </div>
  )
}
