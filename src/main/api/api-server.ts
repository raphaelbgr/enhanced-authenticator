import express from 'express'
import type { Server } from 'node:http'
import { createApiRoutes } from './api-routes'
import { generalLimiter, authFailLimiter } from './rate-limiter'
import { API_PORT, API_HOST } from '../../shared/constants'

let server: Server | null = null

export function startApiServer(port: number = API_PORT): void {
  if (server) return

  const app = express()
  app.use(express.json())
  app.use(generalLimiter)
  app.use(authFailLimiter)
  app.use(createApiRoutes())

  server = app.listen(port, API_HOST, () => {
    console.log(`API server listening on ${API_HOST}:${port}`)
  })
}

export function stopApiServer(): void {
  if (server) {
    server.close()
    server = null
  }
}
