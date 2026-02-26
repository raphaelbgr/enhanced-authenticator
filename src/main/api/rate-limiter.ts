import rateLimit from 'express-rate-limit'
import {
  API_RATE_LIMIT_WINDOW_MS,
  API_RATE_LIMIT_MAX,
  API_AUTH_FAIL_WINDOW_MS,
  API_AUTH_FAIL_MAX
} from '../../shared/constants'

export const generalLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later' }
})

export const authFailLimiter = rateLimit({
  windowMs: API_AUTH_FAIL_WINDOW_MS,
  max: API_AUTH_FAIL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many authentication failures, try again later' }
})
