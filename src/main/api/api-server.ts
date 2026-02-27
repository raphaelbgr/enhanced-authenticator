import express from 'express'
import type { Server } from 'node:http'
import { createApiRoutes } from './api-routes'
import { generalLimiter, authFailLimiter } from './rate-limiter'
import { API_PORT, API_HOST } from '../../shared/constants'

let server: Server | null = null
let state: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped'

export function startApiServer(port: number = API_PORT, host: string = API_HOST): void {
  if (state !== 'stopped') return
  state = 'starting'

  const app = express()
  app.use(express.json())
  app.use(generalLimiter)
  app.use(authFailLimiter)
  app.use(createApiRoutes())

  server = app.listen(port, host, () => {
    state = 'running'
    console.log(`API server listening on ${host}:${port}`)
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`API server port ${port} already in use, skipping`)
    } else {
      console.error('API server error:', err.message)
    }
    server = null
    state = 'stopped'
  })
}

export function stopApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (state !== 'running' && state !== 'starting') {
      resolve()
      return
    }
    state = 'stopping'
    if (server) {
      server.close(() => {
        state = 'stopped'
        resolve()
      })
      server = null
    } else {
      state = 'stopped'
      resolve()
    }
  })
}
