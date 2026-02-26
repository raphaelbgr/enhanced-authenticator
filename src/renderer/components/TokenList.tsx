import React from 'react'
import { useAppStore } from '../store/app-store'
import TokenCard from './TokenCard'

export default function TokenList() {
  const { codes, searchQuery } = useAppStore()

  const filtered = searchQuery
    ? codes.filter(
        (c) =>
          c.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : codes

  if (codes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <div className="text-center">
          <p>No accounts yet.</p>
          <p className="mt-1">Click Import to add your first account.</p>
        </div>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        No matching accounts
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
      {filtered.map((code) => (
        <TokenCard key={code.id} code={code} />
      ))}
    </div>
  )
}
