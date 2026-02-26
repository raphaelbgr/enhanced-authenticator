import React from 'react'

interface CountdownRingProps {
  remaining: number
  period: number
  size?: number
}

export default function CountdownRing({ remaining, period, size = 36 }: CountdownRingProps) {
  const radius = (size - 4) / 2
  const circumference = 2 * Math.PI * radius
  const progress = remaining / period
  const offset = circumference * (1 - progress)
  const isLow = remaining <= 5

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="text-slate-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-200 ${isLow ? 'text-danger' : 'text-accent'}`}
        />
      </svg>
      <span className={`absolute text-xs font-mono ${isLow ? 'text-danger' : 'text-slate-400'}`}>
        {remaining}
      </span>
    </div>
  )
}
