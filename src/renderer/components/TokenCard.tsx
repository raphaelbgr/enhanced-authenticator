import React, { useState, useRef, useEffect } from 'react'
import type { TotpCode } from '../../shared/types'
import CountdownRing from './CountdownRing'
import CopyButton from './CopyButton'
import { formatCode } from '../lib/utils'

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-inherit rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

interface TokenCardProps {
  code: TotpCode
  searchQuery?: string
  onEdit?: (id: string, updates: { issuer?: string; label?: string }) => void
}

export default function TokenCard({ code, searchQuery, onEdit }: TokenCardProps) {
  const [editingField, setEditingField] = useState<'issuer' | 'label' | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingField])

  const startEditing = (field: 'issuer' | 'label') => {
    if (!onEdit) return
    setEditingField(field)
    setEditValue(field === 'issuer' ? code.issuer : code.label)
  }

  const commitEdit = () => {
    if (!editingField || !onEdit) return
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== (editingField === 'issuer' ? code.issuer : code.label)) {
      onEdit(code.id, { [editingField]: trimmed })
    }
    setEditingField(null)
  }

  const cancelEdit = () => {
    setEditingField(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface hover:bg-surface-hover transition-colors group">
      {/* Icon placeholder */}
      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent font-bold text-sm shrink-0">
        {code.issuer.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {editingField === 'issuer' ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="text-sm font-medium text-slate-200 bg-slate-700 rounded px-1 py-0.5 w-full outline-none focus:ring-1 focus:ring-accent"
          />
        ) : (
          <div
            className="text-sm font-medium text-slate-200 truncate cursor-default"
            onDoubleClick={() => startEditing('issuer')}
          >
            {searchQuery ? highlightMatch(code.issuer, searchQuery) : code.issuer}
          </div>
        )}
        {editingField === 'label' ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="text-xs text-slate-400 bg-slate-700 rounded px-1 py-0.5 w-full outline-none focus:ring-1 focus:ring-accent mt-0.5"
          />
        ) : (
          code.label && (
            <div
              className="text-xs text-slate-500 truncate cursor-default"
              onDoubleClick={() => startEditing('label')}
            >
              {searchQuery ? highlightMatch(code.label, searchQuery) : code.label}
            </div>
          )
        )}
        <div className="text-2xl font-mono font-bold tracking-wider text-slate-100 mt-0.5">
          {formatCode(code.code)}
        </div>
      </div>

      {/* Countdown + Copy */}
      <div className="flex items-center gap-2 shrink-0">
        <CountdownRing remaining={code.remaining} period={code.period} />
        <CopyButton text={code.code} />
      </div>
    </div>
  )
}
