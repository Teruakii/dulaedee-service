import assert from 'node:assert/strict'
import { test } from 'node:test'
import bcrypt from 'bcryptjs'
import { INVALID_CREDENTIALS } from '../../constants/errors.js'
import { JWT } from '../../infra/jwt.js'
import { Logger } from '../../infra/logs.js'
import type { NewUser } from '../user/user.dto.js'
import type { UserAuth, UserResponse } from '../user/user.model.js'
import { ErrEmailExists, ErrUserNotFound, ErrUsernameExists, type UserRepo } from '../user/user.repo.js'
import type { Mail } from '../../infra/mail/mailer.js'
import { ErrGoogleEmailUnverified, ErrSessionInvalid, ErrVerifyTokenInvalid, AuthService, googleUsernameBase } from './auth.service.js'

const SECRET = 'test-secret'

class FakeUserRepo implements UserRepo {
  users: (NewUser & { id: string })[] = []
  constructor(seed: NewUser[] = []) {
    seed.forEach((u) => this.users.push({ ...u, id: `id-${this.users.length}` }))
  }
  private resp(u: NewUser & { id: string }): UserResponse {
    return { id: u.id, username: u.username, role: u.role, firstName: u.firstName, lastName: u.lastName, emailVerified: Boolean(u.emailVerified), createdAt: new Date(0), updatedAt: new Date(0) }
  }
  private auth(u: (NewUser & { id: string }) | undefined): UserAuth {
    if (!u) throw ErrUserNotFound
    return { id: u.id, username: u.username, password: u.passwordHash, role: u.role, ...(u.email ? { email: u.email } : {}), emailVerified: Boolean(u.emailVerified) }
  }
  async countUsers() {
    return this.users.length
  }
  async create(n: NewUser) {
    if (this.users.some((u) => u.username === n.username)) throw ErrUsernameExists
    if (n.email && this.users.some((u) => u.email === n.email)) throw ErrEmailExists
    const u = { ...n, id: `id-${this.users.length}` }
    this.users.push(u)
    return this.resp(u)
  }
  async getById(id: string) {
    const u = this.users.find((x) => x.id === id)
    if (!u) throw ErrUserNotFound
    return this.resp(u)
  }
  async getAuthById(id: string) {
    return this.auth(this.users.find((u) => u.id === id))
  }
  async getByUsername(username: string) {
    return this.auth(this.users.find((u) => u.username === username))
  }
  async getByEmail(email: string) {
    return this.auth(this.users.find((u) => u.email === email))
  }
  async list() {
    return { rows: [], hasMore: false }
  }
  async update(id: string) {
    return this.getById(id)
  }
  async updatePasswordHash(id: string, hash: string) {
    this.find(id).passwordHash = hash
  }
  async markEmailVerified(id: string) {
    this.find(id).emailVerified = true
  }
  private find(id: string) {
    const u = this.users.find((x) => x.id === id)
    if (!u) throw ErrUserNotFound
    return u
  }
}

// เก็บอีเมลที่ส่งไว้แทนการส่งจริง
class OutboxMailer {
  sent: Mail[] = []
  async send(m: Mail) {
    this.sent.push(m)
  }
}

const ID = '0123456789abcdef01234567'
const withMail = (repo: FakeUserRepo, mailer = new OutboxMailer()) => ({
  mailer,
  svc: new AuthService(new Logger(), repo, new JWT(SECRET), { secret: SECRET, mailer, clientURL: 'http://app.test' }),
})
const tokenIn = (m: Mail) => new URL(m.text.match(/http:\/\/app\.test\S+/)![0]).searchParams.get('token')!

const newService = (repo: FakeUserRepo) => new AuthService(new Logger(), repo, new JWT(SECRET))

test('login by email or username, wrong password gives INVALID_CREDENTIALS', async () => {
  const passwordHash = await bcrypt.hash('password1', 4)
  const repo = new FakeUserRepo([{ username: 'mind', passwordHash, role: 'MEMBER', firstName: 'มายด์', lastName: '', email: 'mind@example.com' }])
  const svc = newService(repo)

  const byEmail = await svc.login({ username: 'mind@example.com', password: 'password1' })
  assert.equal(new JWT(SECRET).verifyAccessToken(byEmail.token.accessToken).sub, 'id-0')
  await svc.login({ username: 'mind', password: 'password1' })
  await assert.rejects(svc.login({ username: 'mind', password: 'nope' }), (e) => e === INVALID_CREDENTIALS)
  await assert.rejects(svc.login({ username: 'ghost', password: 'password1' }), (e) => e === INVALID_CREDENTIALS)
})

test('register creates a MEMBER with consent timestamps and returns tokens', async () => {
  const repo = new FakeUserRepo()
  const { token, refreshToken } = await newService(repo).register({
    username: 'mind',
    password: 'password1',
    email: 'mind@example.com',
    firstName: 'มายด์',
    lastName: '',
    acceptTerms: true,
    acceptPrivacy: true,
  })
  const u = repo.users[0]!
  assert.equal(u.role, 'MEMBER')
  assert.ok(u.termsAcceptedAt && u.privacyAcceptedAt)
  assert.notEqual(u.passwordHash, 'password1')
  assert.ok(token.accessToken && refreshToken)
})

test('me issues a new access token from a refresh token, rejects an access token used as refresh', async () => {
  const repo = new FakeUserRepo([{ username: 'mind', passwordHash: await bcrypt.hash('password1', 4), role: 'MEMBER', firstName: 'มายด์', lastName: '' }])
  const svc = newService(repo)
  const j = new JWT(SECRET)
  const { refreshToken } = await svc.login({ username: 'mind', password: 'password1' })

  const out = await svc.me('', refreshToken)
  assert.equal(out.user.username, 'mind')
  assert.equal(j.verifyAccessToken(out.accessToken!).sub, 'id-0')

  await assert.rejects(svc.me('', j.generateToken('id-0', 'MEMBER', 60, 'access')), (e) => e === ErrSessionInvalid)
  await assert.rejects(svc.me('', ''), (e) => e === ErrSessionInvalid)
  // refresh ที่ไม่ได้ผูกกับรหัสผ่าน (ออกก่อนระบบนี้) ใช้ไม่ได้
  await assert.rejects(svc.me('', j.generateToken('id-0', 'MEMBER', 60, 'refresh')), (e) => e === ErrSessionInvalid)

  repo.users[0]!.passwordHash = await bcrypt.hash('password2', 4)
  await assert.rejects(svc.me('', refreshToken), (e) => e === ErrSessionInvalid)
})

test('google login reuses an account with the same email and creates nothing', async () => {
  const repo = new FakeUserRepo([{ username: 'staff1', passwordHash: 'x', role: 'STAFF', firstName: 's', lastName: '', email: 'staff@example.com', emailVerified: true }])
  const { token } = await newService(repo).loginWithGoogle({ sub: 'g', email: 'Staff@Example.com', email_verified: true })
  assert.equal(repo.users.length, 1)
  assert.deepEqual(new JWT(SECRET).verifyAccessToken(token.accessToken), { sub: 'id-0', role: 'STAFF' })
  // อีเมลยืนยันแล้ว รหัสผ่านเดิมเป็นของเจ้าของจริง ต้องยังอยู่
  assert.equal(repo.users[0]!.passwordHash, 'x')
})

test('google login on an unverified account wipes the password a squatter may have set and logs their sessions out', async () => {
  const squatterHash = await bcrypt.hash('squatter1', 4)
  const repo = new FakeUserRepo([{ username: 'squat', passwordHash: squatterHash, role: 'MEMBER', firstName: 's', lastName: '', email: 'victim@gmail.com' }])
  const svc = newService(repo)
  const squatter = await svc.login({ username: 'squat', password: 'squatter1' })

  const { token } = await svc.loginWithGoogle({ sub: 'g', email: 'victim@gmail.com', email_verified: true })
  assert.equal(new JWT(SECRET).verifyAccessToken(token.accessToken).sub, 'id-0')
  assert.equal(repo.users[0]!.emailVerified, true)
  await assert.rejects(svc.login({ username: 'squat', password: 'squatter1' }), (e) => e === INVALID_CREDENTIALS)
  await assert.rejects(svc.me('', squatter.refreshToken), (e) => e === ErrSessionInvalid)
})

test('register emails a verify link; the link verifies once the email matches, a forged or stale one does not', async () => {
  const repo = new FakeUserRepo()
  const { svc, mailer } = withMail(repo)
  await svc.register({ username: 'mind', password: 'password1', email: 'mind@example.com', firstName: 'ม', lastName: '', acceptTerms: true, acceptPrivacy: true })
  assert.equal(mailer.sent.length, 1)
  assert.equal(mailer.sent[0]!.to, 'mind@example.com')
  repo.users[0]!.id = ID
  // ลิงก์ออกให้ id-0 ก่อนเปลี่ยน id ใช้ไม่ได้ จึงขอใหม่จาก id จริง
  await svc.resendVerifyEmail(ID)
  const token = tokenIn(mailer.sent[1]!)

  await assert.rejects(svc.verifyEmail({ token: token.slice(0, -2) + 'xx' }), (e) => e === ErrVerifyTokenInvalid)
  repo.users[0]!.email = 'other@example.com'
  await assert.rejects(svc.verifyEmail({ token }), (e) => e === ErrVerifyTokenInvalid)
  repo.users[0]!.email = 'mind@example.com'
  await svc.verifyEmail({ token })
  assert.equal(repo.users[0]!.emailVerified, true)

  await svc.resendVerifyEmail(ID)
  assert.equal(mailer.sent.length, 2, 'no more mail once verified')
})

test('a password reset through the emailed link also verifies the email', async () => {
  const repo = new FakeUserRepo([{ username: 'mind', passwordHash: await bcrypt.hash('password1', 4), role: 'MEMBER', firstName: 'ม', lastName: '', email: 'mind@example.com' }])
  repo.users[0]!.id = ID
  const { svc, mailer } = withMail(repo)
  await svc.forgotPassword({ email: 'mind@example.com' })
  await svc.resetPassword({ token: tokenIn(mailer.sent[0]!), newPassword: 'password2' })
  assert.equal(repo.users[0]!.emailVerified, true)
  await svc.login({ username: 'mind', password: 'password2' })
})

test('google login creates a MEMBER with a unique username when the email is new', async () => {
  const repo = new FakeUserRepo([{ username: 'somchai', passwordHash: 'x', role: 'MEMBER', firstName: 's', lastName: '' }])
  await newService(repo).loginWithGoogle({ sub: 'g', email: 'Somchai@gmail.com', email_verified: true, given_name: 'สมชาย', family_name: 'ใจดี' })
  const u = repo.users.at(-1)!
  assert.equal(u.emailVerified, true)
  assert.equal(u.username, 'somchai2')
  assert.equal(u.role, 'MEMBER')
  assert.equal(u.email, 'somchai@gmail.com')
  assert.equal(u.firstName, 'สมชาย')
  assert.equal(u.lastName, 'ใจดี')
})

test('google login rejects an unverified email without creating a user', async () => {
  const repo = new FakeUserRepo()
  await assert.rejects(newService(repo).loginWithGoogle({ sub: 'g', email: 'a@b.com', email_verified: false }), (e) => e === ErrGoogleEmailUnverified)
  assert.equal(repo.users.length, 0)
})

test('googleUsernameBase', () => {
  assert.equal(googleUsernameBase('john.doe+fit@gmail.com'), 'john.doefit')
  assert.equal(googleUsernameBase('ab@x.com'), 'userab')
  assert.equal(googleUsernameBase('ไทย@x.com'), 'user')
})
