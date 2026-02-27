import React, { useCallback, useRef, useState } from 'react'
import { useAppStore, type SortMode } from '../store/app-store'
import type { TotpCode } from '../../shared/types'
import TokenCard from './TokenCard'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'issuer-asc', label: 'Issuer A\u2013Z' },
  { value: 'issuer-desc', label: 'Issuer Z\u2013A' },
  { value: 'label-asc', label: 'Label A\u2013Z' },
  { value: 'label-desc', label: 'Label Z\u2013A' },
  { value: 'custom', label: 'Custom Order' }
]

function sortCodes(codes: TotpCode[], mode: SortMode): TotpCode[] {
  if (mode === 'custom') return codes
  const sorted = [...codes]
  sorted.sort((a, b) => {
    switch (mode) {
      case 'issuer-asc':
        return a.issuer.localeCompare(b.issuer, undefined, { sensitivity: 'base' }) ||
               a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      case 'issuer-desc':
        return b.issuer.localeCompare(a.issuer, undefined, { sensitivity: 'base' }) ||
               b.label.localeCompare(a.label, undefined, { sensitivity: 'base' })
      case 'label-asc':
        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) ||
               a.issuer.localeCompare(b.issuer, undefined, { sensitivity: 'base' })
      case 'label-desc':
        return b.label.localeCompare(a.label, undefined, { sensitivity: 'base' }) ||
               b.issuer.localeCompare(a.issuer, undefined, { sensitivity: 'base' })
      default:
        return 0
    }
  })
  return sorted
}

export default function TokenList() {
  const { codes, searchQuery, sortMode, setSortMode } = useAppStore()
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = searchQuery
    ? codes.filter(
        (c) =>
          c.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : codes

  const sorted = sortCodes(filtered, sortMode)

  const handleDragStart = useCallback((id: string) => {
    setDragId(id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOverId(id)
  }, [])

  const handleDrop = useCallback(
    async (targetId: string) => {
      if (!dragId || dragId === targetId) {
        setDragId(null)
        setDragOverId(null)
        return
      }

      // Build reordered ID list from current sorted view
      const ids = sorted.map((c) => c.id)
      const fromIdx = ids.indexOf(dragId)
      const toIdx = ids.indexOf(targetId)
      if (fromIdx === -1 || toIdx === -1) return

      ids.splice(fromIdx, 1)
      ids.splice(toIdx, 0, dragId)

      // If we were in a non-custom sort, switch to custom
      if (sortMode !== 'custom') {
        setSortMode('custom')
      }

      await window.api.accountsReorder(ids)
      setDragId(null)
      setDragOverId(null)
    },
    [dragId, sorted, sortMode, setSortMode]
  )

  const handleEdit = useCallback(async (id: string, updates: { issuer?: string; label?: string }) => {
    await window.api.accountsUpdate(id, updates)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragId(null)
    setDragOverId(null)
  }, [])

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

  const currentSort = SORT_OPTIONS.find((o) => o.value === sortMode)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Counter + Sort controls */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">
          {searchQuery
            ? `${filtered.length} of ${codes.length} account${codes.length !== 1 ? 's' : ''}`
            : `${codes.length} account${codes.length !== 1 ? 's' : ''}`}
        </span>

        <div className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {currentSort?.label}
          </button>

          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 top-6 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSortMode(opt.value)
                      setShowSortMenu(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      sortMode === opt.value
                        ? 'text-accent bg-accent/10'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          No matching accounts
        </div>
      ) : (
        <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1">
          {sorted.map((code) => (
            <div
              key={code.id}
              draggable
              onDragStart={() => handleDragStart(code.id)}
              onDragOver={(e) => handleDragOver(e, code.id)}
              onDrop={() => handleDrop(code.id)}
              onDragEnd={handleDragEnd}
              className={`transition-all ${
                dragId === code.id ? 'opacity-40' : ''
              } ${
                dragOverId === code.id && dragId !== code.id
                  ? 'border-t-2 border-accent pt-0.5'
                  : ''
              }`}
            >
              <TokenCard code={code} searchQuery={searchQuery} onEdit={handleEdit} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
