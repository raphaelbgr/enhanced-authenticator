import React, { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

type Tab = 'camera' | 'file'

interface QrScanDialogProps {
  open: boolean
  onClose: () => void
}

export default function QrScanDialog({ open, onClose }: QrScanDialogProps) {
  const [tab, setTab] = useState<Tab>('camera')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannedBatches, setScannedBatches] = useState(0)
  const [expectedBatches, setExpectedBatches] = useState<number | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
  }, [])

  const handleDecodedUri = useCallback(
    async (uri: string) => {
      setLoading(true)
      try {
        let res
        if (uri.startsWith('otpauth-migration://')) {
          res = await window.api.accountsImportMigration(uri)
        } else if (uri.startsWith('otpauth://')) {
          res = await window.api.accountsImportUri(uri)
        } else {
          setResult('QR code does not contain a valid otpauth:// or otpauth-migration:// URI.')
          setLoading(false)
          return
        }

        const msg = `Imported ${res.imported} account(s)${res.skipped ? `, skipped ${res.skipped}` : ''}`
        setResult(res.errors.length ? `${msg}. Errors: ${res.errors.join('; ')}` : msg)

        // Check for batch migration
        if (uri.startsWith('otpauth-migration://')) {
          setScannedBatches((prev) => prev + 1)
        }
      } catch (e) {
        setResult(`Error: ${(e as Error).message}`)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      scanningRef.current = true
      const canvas = canvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      const scan = () => {
        if (!scanningRef.current || !video.videoWidth) {
          if (scanningRef.current) requestAnimationFrame(scan)
          return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code && code.data) {
          const uri = code.data
          if (uri.startsWith('otpauth://') || uri.startsWith('otpauth-migration://')) {
            // Pause scanning briefly to avoid duplicate reads
            scanningRef.current = false
            handleDecodedUri(uri).then(() => {
              // Resume scanning for batch QRs
              setTimeout(() => {
                scanningRef.current = true
                requestAnimationFrame(scan)
              }, 2000)
            })
            return
          }
        }

        requestAnimationFrame(scan)
      }

      requestAnimationFrame(scan)
    } catch (e) {
      setCameraError((e as Error).message || 'Camera access denied')
    }
  }, [handleDecodedUri])

  useEffect(() => {
    if (!open) {
      stopCamera()
      setResult(null)
      setScannedBatches(0)
      setExpectedBatches(null)
      setCameraError(null)
      return
    }

    if (tab === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }

    return stopCamera
  }, [open, tab, startCamera, stopCamera])

  if (!open) return null

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setResult(null)
    try {
      // Read the file and decode QR in the renderer using canvas
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not available')
      ctx.drawImage(bitmap, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)

      if (!code) {
        setResult('No QR code found in the image.')
        return
      }

      await handleDecodedUri(code.data)
    } catch (err) {
      setResult(`Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
      // Reset input so the same file can be selected again
      e.target.value = ''
    }
  }

  const tabClass = (t: Tab) =>
    `flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? 'bg-accent text-white'
        : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover'
    }`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Scan QR Code</h2>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface rounded-lg p-1 mb-3">
          <button onClick={() => setTab('camera')} className={tabClass('camera')}>
            Camera
          </button>
          <button onClick={() => setTab('file')} className={tabClass('file')}>
            Image File
          </button>
        </div>

        {/* Camera tab */}
        {tab === 'camera' && (
          <div>
            {cameraError ? (
              <div className="bg-surface rounded-xl p-4 mb-3">
                <p className="text-sm text-danger mb-2">Camera error: {cameraError}</p>
                <button
                  onClick={startCamera}
                  className="text-sm text-accent hover:text-accent-hover"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="relative bg-black rounded-xl overflow-hidden mb-3">
                <video ref={videoRef} className="w-full" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-accent/50 rounded-xl" />
                </div>
              </div>
            )}

            {scannedBatches > 0 && (
              <p className="text-xs text-slate-400 mb-2">
                Scanned {scannedBatches} QR code(s)
                {expectedBatches ? ` of ${expectedBatches}` : ''}.
                {expectedBatches && scannedBatches < expectedBatches
                  ? ' Show next QR to continue.'
                  : ''}
              </p>
            )}
          </div>
        )}

        {/* File tab */}
        {tab === 'file' && (
          <div className="mb-3">
            <label className="flex flex-col items-center justify-center w-full h-32 bg-surface border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-accent/50 transition-colors">
              <svg
                className="w-8 h-8 text-slate-500 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm text-slate-400">Click to select image</span>
              <span className="text-xs text-slate-500 mt-1">PNG, JPG, or WebP</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Result */}
        {result && (
          <p
            className={`text-sm mb-3 ${
              result.includes('Error') || result.includes('No QR') || result.includes('not contain')
                ? 'text-danger'
                : 'text-success'
            }`}
          >
            {result}
          </p>
        )}

        {loading && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Processing...</span>
          </div>
        )}

        <button
          onClick={() => {
            stopCamera()
            onClose()
          }}
          className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-surface-hover transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}
