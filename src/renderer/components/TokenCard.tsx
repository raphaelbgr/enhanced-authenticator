import React from 'react'
import type { TotpCode } from '../../shared/types'
import CountdownRing from './CountdownRing'
import CopyButton from './CopyButton'
import { formatCode } from '../lib/utils'

interface TokenCardProps {
  code: TotpCode
}

export default function TokenCard({ code }: TokenCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface hover:bg-surface-hover transition-colors group">
      {/* Icon placeholder */}
      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent font-bold text-sm shrink-0">
        {code.issuer.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">{code.issuer}</div>
        {code.label && (
          <div className="text-xs text-slate-500 truncate">{code.label}</div>
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
