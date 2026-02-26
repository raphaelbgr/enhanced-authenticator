import React from 'react'
import { useAppStore } from '../store/app-store'

export default function SearchBar() {
  const { searchQuery, setSearchQuery } = useAppStore()

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search accounts..."
        className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-slate-700 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent text-sm"
      />
    </div>
  )
}
