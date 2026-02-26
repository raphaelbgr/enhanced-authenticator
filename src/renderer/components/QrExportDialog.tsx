import React, { useEffect, useState } from 'react'

interface QrBatch {
  dataUrl: string
  batchIndex: number
  batchTotal: number
  accountNames: string[]
}

interface QrExportDialogProps {
  open: boolean
  onClose: () => void
}

export default function QrExportDialog({ open, onClose }: QrExportDialogProps) {
  const [batches, setBatches] = useState<QrBatch[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setCurrentIndex(0)
    setBatches([])

    window.api
      .accountsExportQr()
      .then((result) => {
        if (result.length === 0) {
          setError('No accounts to export')
        } else {
          setBatches(result)
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const current = batches[currentIndex]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-1">Export as QR Code</h2>
        <p className="text-xs text-slate-400 mb-3">
          Scan with Google Authenticator or any app that supports{' '}
          <span className="text-slate-300">otpauth-migration://</span> import.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && <p className="text-sm text-danger py-4">{error}</p>}

        {current && (
          <>
            <div className="flex items-center justify-center bg-white rounded-xl p-3 mb-3">
              <img src={current.dataUrl} alt="QR Code" className="w-72 h-72" />
            </div>

            {current.batchTotal > 1 && (
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCurrentIndex((i) => i - 1)}
                  disabled={currentIndex === 0}
                  className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-surface-hover disabled:opacity-30 transition-colors text-sm"
                >
                  Prev
                </button>
                <span className="text-sm text-slate-400">
                  QR {currentIndex + 1} of {current.batchTotal}
                </span>
                <button
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  disabled={currentIndex === current.batchTotal - 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-surface-hover disabled:opacity-30 transition-colors text-sm"
                >
                  Next
                </button>
              </div>
            )}

            <div className="max-h-24 overflow-y-auto mb-3">
              <p className="text-xs text-slate-500 mb-1">
                Accounts in this QR ({current.accountNames.length}):
              </p>
              {current.accountNames.map((name, i) => (
                <p key={i} className="text-xs text-slate-400 truncate">
                  {name}
                </p>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-surface-hover transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}
