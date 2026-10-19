import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { INVALID_CREDENTIALS, sentinel } from '../../constants/errors.js'
import type { Role } from '../../constants/role.js'
import { ErrWrongTokenType, type JWT } from '../../infra/jwt.js'
import type { Logger } from '../../infra/logs.js'
import type { OAuthUser } from '../../infra/oauth/google.js'
import { ErrUsernameExists, ErrUserNotFound, type UserRepo } from '../user/user.repo.js'
import type { Mailer } from '../../infra/mail/mailer.js'
import type {
  AdminResetPasswordRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  MeResponse,
  RegisterRequest,
  ResetPasswordRequest,
  TokenResponse,
  VerifyEmailRequest,
} from './auth.dto.js'
import { makeResetToken, makeVerifyEmailToken, RESET_TTL_MIN, tokenUser, verifyEmailToken, verifyResetToken } from './reset.js'
import { ACCESS_TTL_SEC, ME_ACCESS_TTL_SEC, REFRESH_TTL_SEC, randomToken } from './auth.utils.js'

export const ErrSessionInvalid = sentinel('SESSION_INVALID')
export const ErrGoogleEmailUnverified = sentinel('GOOGLE_EMAIL_UNVERIFIED')
export const ErrResetTokenInvalid = sentinel('RESET_TOKEN_INVALID')
export const ErrVerifyTokenInvalid = sentinel('VERIFY_EMAIL_TOKEN_INVALID')

export type ResetOptions = { secret: string; mailer: Mailer; clientURL: string }

export type Tokens = { token: TokenResponse; refreshToken: string }

const usernameStrip = /[^a-z0-9._-]+/g

// ใส่ใน refresh token แทน hash จริง · เปลี่ยนรหัสผ่านแล้วค่านี้เปลี่ยน refresh เดิมทุกเครื่องจึงใช้ไม่ได้
const passwordFingerprint = (passwordHash: string) => createHash('sha256').update(passwordHash).digest('base64url').slice(0, 16)

// ผู้ใช้ไม่มีอยู่ก็ยังเทียบ bcrypt ให้เสียเวลาเท่ากัน ไม่ให้จับเวลาตอบเดาได้ว่าชื่อไหนมีบัญชี
const DUMMY_HASH = bcrypt.hashSync('dulaedee-no-such-user', 10)

export function googleUsernameBase(email: string): string {
  let local = (email.split('@')[0] ?? '').toLowerCase().replace(usernameStrip, '')
  if (local.length > 40) local = local.slice(0, 40)
  if (local.length < 3) local = 'user' + local
  return local
}

export class AuthService {
  constructor(
    readonly logger: Logger,
    private readonly userRepo: UserRepo,
    private readonly jwt: JWT,
    private readonly reset?: ResetOptions,
  ) {}

  async login(req: LoginRequest): Promise<Tokens> {
    const rec = await (req.username.includes('@') ? this.userRepo.getByEmail(req.username) : this.userRepo.getByUsername(req.username)).catch(
      () => null,
    )
    // ไม่บอกว่าผิดที่ชื่อหรือรหัส
    const matched = await bcrypt.compare(req.password, rec?.password ?? DUMMY_HASH)
    if (!rec || !matched) throw INVALID_CREDENTIALS
    return this.issueTokens(rec.id, rec.role, rec.password)
  }

  async register(req: RegisterRequest): Promise<Tokens> {
    const now = new Date()
    const passwordHash = await bcrypt.hash(req.password, 10)
    const created = await this.userRepo.create({
      username: req.username,
      passwordHash,
      role: 'MEMBER',
      firstName: req.firstName,
      lastName: req.lastName,
      email: req.email,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
    })
    // ส่งไม่ออกก็ยังสมัครสำเร็จ ขอลิงก์ใหม่จากหน้าโปรไฟล์ได้
    await this.sendVerifyEmail(created.id, req.email).catch((err) => this.logger.error('ERROR_SENDING_VERIFY_EMAIL', err))
    return this.issueTokens(created.id, created.role, passwordHash)
  }

  async resendVerifyEmail(userID: string): Promise<void> {
    const rec = await this.userRepo.getAuthById(userID)
    if (rec.email && !rec.emailVerified) await this.sendVerifyEmail(rec.id, rec.email)
  }

  private async sendVerifyEmail(userID: string, email: string): Promise<void> {
    if (!this.reset) return
    const link = `${this.reset.clientURL}/verify-email?token=${makeVerifyEmailToken(this.reset.secret, userID, email)}`
    await this.reset.mailer.send({
      to: email,
      subject: 'ยืนยันอีเมล · ดูแลดี',
      text: `กดลิงก์นี้เพื่อยืนยันว่าอีเมลนี้เป็นของคุณ (ใช้ได้ 24 ชั่วโมง):
${link}

ถ้าคุณไม่ได้สมัครดูแลดี ไม่ต้องทำอะไร`,
    })
  }

  async verifyEmail(req: VerifyEmailRequest): Promise<void> {
    if (!this.reset) throw new Error('email verification is not configured')
    const t = tokenUser(req.token)
    const rec = t ? await this.userRepo.getAuthById(t.userId).catch(() => null) : null
    if (!rec?.email || !verifyEmailToken(this.reset.secret, req.token, rec.email)) throw ErrVerifyTokenInvalid
    await this.userRepo.markEmailVerified(rec.id)
  }

  // ตรวจ access ก่อน ถ้าหมดอายุหรือไม่ส่งมา ใช้ refresh ออก access ใหม่
  async me(accessToken: string, refreshToken: string): Promise<MeResponse> {
    if (accessToken) {
      try {
        const claims = this.jwt.verifyAccessToken(accessToken)
        return { user: await this.profile(claims.sub) }
      } catch (err) {
        if (err === ErrWrongTokenType || err === ErrSessionInvalid) throw ErrSessionInvalid
      }
    }
    if (!refreshToken) throw ErrSessionInvalid
    let claims
    try {
      claims = this.jwt.verifyRefreshToken(refreshToken)
    } catch {
      throw ErrSessionInvalid
    }
    const rec = await this.userRepo.getAuthById(claims.sub).catch(() => null)
    if (!rec || claims.pv !== passwordFingerprint(rec.password)) throw ErrSessionInvalid
    const user = await this.profile(claims.sub)
    // role ล่าสุดจากฐานข้อมูล เผื่อ admin เปลี่ยน role หลังออก refresh token
    return { user, accessToken: this.jwt.generateToken(user.id, user.role, ME_ACCESS_TTL_SEC, 'access') }
  }

  private async profile(userID: string) {
    try {
      return await this.userRepo.getById(userID)
    } catch (err) {
      if (err === ErrUserNotFound) throw ErrSessionInvalid
      throw err
    }
  }

  // ออกโทเคนใหม่ให้เครื่องที่เปลี่ยนรหัส เครื่องอื่นหลุดเพราะ refresh เดิมผูกกับรหัสเก่า
  async changeOwnPassword(userID: string, req: ChangePasswordRequest): Promise<Tokens> {
    const rec = await this.userRepo.getAuthById(userID)
    if (!(await bcrypt.compare(req.currentPassword, rec.password))) throw INVALID_CREDENTIALS
    const passwordHash = await bcrypt.hash(req.newPassword, 10)
    await this.userRepo.updatePasswordHash(userID, passwordHash)
    return this.issueTokens(rec.id, rec.role, passwordHash)
  }

  // ตอบเหมือนกันทุกกรณี ไม่บอกว่าอีเมลนี้มีบัญชีหรือไม่
  async forgotPassword(req: ForgotPasswordRequest): Promise<void> {
    if (!this.reset) throw new Error('password reset is not configured')
    const rec = await this.userRepo.getByEmail(req.email).catch(() => null)
    if (!rec) return
    const link = `${this.reset.clientURL}/reset-password?token=${makeResetToken(this.reset.secret, rec.id, rec.password)}`
    await this.reset.mailer.send({
      to: req.email,
      subject: 'ตั้งรหัสผ่านใหม่ · ดูแลดี',
      text: `มีคนขอตั้งรหัสผ่านใหม่ให้บัญชี ${rec.username}

กดลิงก์นี้ภายใน ${RESET_TTL_MIN} นาที:
${link}

ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้`,
    })
  }

  async resetPassword(req: ResetPasswordRequest): Promise<void> {
    if (!this.reset) throw new Error('password reset is not configured')
    const t = tokenUser(req.token)
    if (!t) throw ErrResetTokenInvalid
    const rec = await this.userRepo
      .getById(t.userId)
      .then((u) => this.userRepo.getByUsername(u.username))
      .catch(() => null)
    if (!rec || !verifyResetToken(this.reset.secret, req.token, rec.password)) throw ErrResetTokenInvalid
    await this.userRepo.updatePasswordHash(rec.id, await bcrypt.hash(req.newPassword, 10))
    // ลิงก์ไปถึงกล่องอีเมลนี้จริง จึงนับว่ายืนยันอีเมลแล้ว
    await this.userRepo.markEmailVerified(rec.id)
  }

  async adminResetPassword(targetUserID: string, req: AdminResetPasswordRequest): Promise<void> {
    await this.userRepo.updatePasswordHash(targetUserID, await bcrypt.hash(req.newPassword, 10))
  }

  // login ด้วยอีเมลที่ Google ยืนยันแล้ว · ยังไม่มีบัญชี = สร้าง MEMBER ใหม่
  async loginWithGoogle(g: OAuthUser): Promise<Tokens> {
    const email = (g.email ?? '').trim().toLowerCase()
    if (!email || !g.email_verified) throw ErrGoogleEmailUnverified

    const existing = await this.userRepo.getByEmail(email).catch(() => null)
    if (existing?.emailVerified) return this.issueTokens(existing.id, existing.role, existing.password)
    if (existing) {
      // บัญชีนี้สมัครด้วยอีเมลที่ยังไม่มีใครยืนยัน รหัสผ่านอาจเป็นของคนอื่นที่สมัครดักไว้
      // Google ยืนยันแล้วว่าคนนี้เป็นเจ้าของอีเมล จึงล้างรหัสผ่านเดิม (session เก่าหลุดด้วย) ตั้งใหม่ได้ทาง "ลืมรหัสผ่าน"
      const passwordHash = await bcrypt.hash(randomToken(32), 10)
      await this.userRepo.updatePasswordHash(existing.id, passwordHash)
      await this.userRepo.markEmailVerified(existing.id)
      this.logger.info('GOOGLE_CLAIMED_UNVERIFIED_ACCOUNT')
      return this.issueTokens(existing.id, existing.role, passwordHash)
    }

    // บัญชีจาก Google ไม่มีรหัสผ่านที่ใช้ได้ ตั้งเองภายหลังผ่าน "ลืมรหัสผ่าน"
    const passwordHash = await bcrypt.hash(randomToken(32), 10)
    const firstName = g.given_name?.trim() || g.name?.trim() || email.split('@')[0]!
    const lastName = g.family_name?.trim() ?? ''

    const base = googleUsernameBase(email)
    for (let i = 0; i < 20; i++) {
      const username = i === 0 ? base : `${base}${i + 1}`
      try {
        const created = await this.userRepo.create({ username, passwordHash, role: 'MEMBER', firstName, lastName, email, emailVerified: true })
        this.logger.info('GOOGLE_USER_CREATED')
        return this.issueTokens(created.id, created.role, passwordHash)
      } catch (err) {
        if (err !== ErrUsernameExists) throw err
      }
    }
    throw ErrUsernameExists
  }

  private issueTokens(userID: string, role: Role, passwordHash: string): Tokens {
    return {
      token: { accessToken: this.jwt.generateToken(userID, role, ACCESS_TTL_SEC, 'access') },
      refreshToken: this.jwt.generateToken(userID, role, REFRESH_TTL_SEC, 'refresh', passwordFingerprint(passwordHash)),
    }
  }
}
