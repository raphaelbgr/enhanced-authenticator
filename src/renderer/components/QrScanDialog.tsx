import React, { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

type Tab = 'camera' | 'file'

interface QrScanDialogProps {
  open: boolean
  onClose: () => void
}

interface BatchResult {
  imported: number
  skipped: number
  failed: number
  errors: string[]
}

async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(imageData.data, imageData.width, imageData.height)
  return code?.data ?? null
}

export default function QrScanDialog({ open, onClose }: QrScanDialogProps) {
  const [tab, setTab] = useState<Tab>('camera')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannedBatches, setScannedBatches] = useState(0)
  const [expectedBatches, setExpectedBatches] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
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

  const handleMultipleFiles = useCallback(async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) {
      setResult('No image files found.')
      return
    }

    setLoading(true)
    setResult(null)
    setProgress(`Processing 0 of ${images.length}...`)

    const batch: BatchResult = { imported: 0, skipped: 0, failed: 0, errors: [] }

    for (let i = 0; i < images.length; i++) {
      setProgress(`Processing ${i + 1} of ${images.length}...`)
      try {
        const uri = await decodeQrFromFile(images[i])
        if (!uri) {
          batch.failed++
          batch.errors.push(`${images[i].name}: no QR code found`)
          continue
        }

        let res
        if (uri.startsWith('otpauth-migration://')) {
          res = await window.api.accountsImportMigration(uri)
        } else if (uri.startsWith('otpauth://')) {
          res = await window.api.accountsImportUri(uri)
        } else {
          batch.failed++
          batch.errors.push(`${images[i].name}: not a valid otpauth URI`)
          continue
        }

        batch.imported += res.imported
        batch.skipped += res.skipped
        for (const err of res.errors) {
          batch.errors.push(`${images[i].name}: ${err}`)
        }
      } catch (e) {
        batch.failed++
        batch.errors.push(`${images[i].name}: ${(e as Error).message}`)
      }
    }

    setProgress(null)
    setLoading(false)

    const parts: string[] = []
    parts.push(`Imported ${batch.imported} account(s) from ${images.length} image(s)`)
    if (batch.skipped) parts.push(`${batch.skipped} skipped`)
    if (batch.failed) parts.push(`${batch.failed} failed`)
    let msg = parts.join(', ')
    if (batch.errors.length > 0) {
      const shown = batch.errors.slice(0, 3)
      msg += '. ' + shown.join('; ')
      if (batch.errors.length > 3) msg += `; +${batch.errors.length - 3} more`
    }
    setResult(msg)
  }, [])

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
              resumeTimerRef.current = setTimeout(() => {
                resumeTimerRef.current = null
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
      setProgress(null)
      setDragging(false)
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
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    e.target.value = ''
    await handleMultipleFiles(files)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)

    const items = e.dataTransfer.files
    if (!items || items.length === 0) return
    const files = Array.from(items).filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) {
      setResult('No image files found in dropped items.')
      return
    }
    await handleMultipleFiles(files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
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
            Image Files
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
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center w-full h-32 bg-surface border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                dragging
                  ? 'border-accent bg-accent/10'
                  : 'border-slate-600 hover:border-accent/50'
              }`}
            >
              <svg
                className={`w-8 h-8 mb-2 ${dragging ? 'text-accent' : 'text-slate-500'}`}
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
              <span className="text-sm text-slate-400">
                {dragging ? 'Drop images here' : 'Click or drag & drop images'}
              </span>
              <span className="text-xs text-slate-500 mt-1">PNG, JPG, or WebP — multiple files supported</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <p
            className={`text-sm mb-3 ${
              result.includes('Error') || result.includes('No QR') || result.includes('not contain') || result.includes('No image')
                ? 'text-danger'
                : result.includes('failed')
                  ? 'text-warning'
                  : 'text-success'
            }`}
          >
            {result}
          </p>
        )}

        {(loading || progress) && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">{progress || 'Processing...'}</span>
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
