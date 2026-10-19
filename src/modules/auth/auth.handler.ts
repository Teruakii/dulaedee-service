import { timingSafeEqual } from 'node:crypto'
import type { Response } from 'express'
import { INVALID_CREDENTIALS } from '../../constants/errors.js'
import {
  created,
  errorBoundary,
  ok,
  param,
  serviceUnavailable,
  success,
  writeMapped,
  type ErrTable,
} from '../../infra/http/response.js'
import type { GoogleOAuth } from '../../infra/oauth/google.js'
import { bearerToken, currentUser } from '../../middleware/auth.js'
import { ErrEmailExists, ErrUserNotFound, ErrUsernameExists } from '../user/user.repo.js'
import {
  AdminResetPasswordRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from './auth.dto.js'
import { ErrGoogleEmailUnverified, ErrResetTokenInvalid, ErrSessionInvalid, ErrVerifyTokenInvalid, type AuthService } from './auth.service.js'
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_PATH,
  REFRESH_COOKIE,
  clearCookie,
  randomToken,
  setCookie,
  setRefreshCookie,
} from './auth.utils.js'

const errTable: ErrTable = new Map([
  [INVALID_CREDENTIALS, 401],
  [ErrSessionInvalid, 401],
  [ErrUserNotFound, 404],
  [ErrUsernameExists, 400],
  [ErrEmailExists, 400],
  [ErrResetTokenInvalid, 400],
  [ErrVerifyTokenInvalid, 400],
])

export const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)

// เทียบความยาวเป็น byte ไม่ใช่จำนวนตัวอักษร อักษรไทยหนึ่งตัวยาว 3 byte ทำให้ timingSafeEqual throw
const sameToken = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export class AuthHandler {
  constructor(
    private readonly svc: AuthService,
    private readonly google: GoogleOAuth | null,
    private readonly clientURL: string,
  ) {}

  login = h(async (req, res) => {
    const { token, refreshToken } = await this.svc.login(LoginRequest.parse(req.body))
    setRefreshCookie(res, refreshToken)
    ok(res, token)
  })

  register = h(async (req, res) => {
    const { token, refreshToken } = await this.svc.register(RegisterRequest.parse(req.body))
    setRefreshCookie(res, refreshToken)
    created(res, 'REGISTERED', token)
  })

  logout = h(async (_req, res) => {
    clearCookie(res, REFRESH_COOKIE, '/')
    success(res, 'LOGOUT_SUCCESS')
  })

  // ไม่ตั้ง refresh cookie ใหม่ มีเฉพาะตอน login
  me = h(async (req, res) => {
    ok(res, await this.svc.me(bearerToken(req), String(req.cookies?.[REFRESH_COOKIE] ?? '')))
  })

  changePassword = h(async (req, res) => {
    const { token, refreshToken } = await this.svc.changeOwnPassword(currentUser(res).userID, ChangePasswordRequest.parse(req.body))
    setRefreshCookie(res, refreshToken)
    ok(res, token)
  })

  forgotPassword = h(async (req, res) => {
    await this.svc.forgotPassword(ForgotPasswordRequest.parse(req.body))
    success(res, 'RESET_LINK_SENT_IF_ACCOUNT_EXISTS')
  })

  resetPassword = h(async (req, res) => {
    await this.svc.resetPassword(ResetPasswordRequest.parse(req.body))
    success(res, 'PASSWORD_RESET')
  })

  verifyEmail = h(async (req, res) => {
    await this.svc.verifyEmail(VerifyEmailRequest.parse(req.body))
    success(res, 'EMAIL_VERIFIED')
  })

  resendVerifyEmail = h(async (_req, res) => {
    await this.svc.resendVerifyEmail(currentUser(res).userID)
    success(res, 'VERIFY_EMAIL_SENT')
  })

  adminResetPassword = h(async (req, res) => {
    await this.svc.adminResetPassword(param(req, 'id'), AdminResetPasswordRequest.parse(req.body))
    success(res, 'PASSWORD_RESET')
  })

  // ส่ง URL ของ Google กลับไป พร้อม state cookie อายุสั้นกัน CSRF
  googleStart = h(async (_req, res) => {
    if (!this.google) return serviceUnavailable(res, 'GOOGLE_OAUTH_NOT_CONFIGURED')
    const state = randomToken(24)
    setCookie(res, OAUTH_STATE_COOKIE, state, OAUTH_STATE_PATH, 10 * 60)
    ok(res, { url: this.google.getLoginURL(state) })
  })

  // ตรวจ state แลก code ตั้ง refresh cookie แล้ว redirect กลับ SPA ซึ่งจะขอ access จาก /auth/me
  googleCallback = h(async (req, res) => {
    const fail = (reason: string) => res.redirect(302, `${this.clientURL}/auth/google/failed?reason=${encodeURIComponent(reason)}`)
    if (!this.google) return fail('GOOGLE_OAUTH_NOT_CONFIGURED')

    const expected = String(req.cookies?.[OAUTH_STATE_COOKIE] ?? '')
    clearCookie(res, OAUTH_STATE_COOKIE, OAUTH_STATE_PATH)
    if (!expected || !sameToken(expected, String(req.query['state'] ?? ''))) return fail('INVALID_STATE')
    if (req.query['error']) return fail('CANCELLED')
    const code = String(req.query['code'] ?? '')
    if (!code) return fail('MISSING_CODE')

    let gUser
    try {
      gUser = await this.google.exchangeCode(code)
    } catch (err) {
      this.svc.logger.error('ERROR_GOOGLE_EXCHANGE', err)
      return fail('GOOGLE_EXCHANGE_FAILED')
    }
    try {
      const { refreshToken } = await this.svc.loginWithGoogle(gUser)
      setRefreshCookie(res, refreshToken)
    } catch (err) {
      this.svc.logger.error('ERROR_GOOGLE_LOGIN', err)
      return fail(err === ErrGoogleEmailUnverified ? ErrGoogleEmailUnverified.message : 'GOOGLE_LOGIN_FAILED')
    }
    res.redirect(302, `${this.clientURL}/auth/google/success`)
  })
}
