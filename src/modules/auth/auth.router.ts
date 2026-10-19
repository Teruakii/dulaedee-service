import { Router, type Express } from 'express'
import type { JWT } from '../../infra/jwt.js'
import { auth } from '../../middleware/auth.js'
import { forgotLimit, loginLimit, passwordLimit, registerLimit } from '../../middleware/rateLimit.js'
import type { AuthHandler } from './auth.handler.js'

export function mount(app: Express, h: AuthHandler, j: JWT) {
  const r = Router()
  r.post('/login', loginLimit, h.login)
  r.post('/register', registerLimit, h.register)
  r.post('/logout', h.logout)
  r.get('/me', h.me)

  r.get('/google', h.googleStart)
  r.get('/google/callback', h.googleCallback)

  r.post('/forgot-password', forgotLimit, h.forgotPassword)
  r.post('/reset-password', passwordLimit, h.resetPassword)
  r.post('/verify-email', passwordLimit, h.verifyEmail)
  r.post('/verify-email/resend', auth(j), forgotLimit, h.resendVerifyEmail)
  r.post('/change-password', auth(j), passwordLimit, h.changePassword)
  r.post('/admin/users/:id/reset-password', auth(j, 'ADMIN'), h.adminResetPassword)
  app.use('/auth', r)
}
