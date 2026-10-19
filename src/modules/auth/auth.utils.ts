import { randomBytes } from 'node:crypto'
import type { Response } from 'express'

export const ACCESS_TTL_SEC = 15 * 60
// ตรงกับอายุ cookie refresh_token
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60
// access ที่ออกใหม่ผ่าน /auth/me อายุสั้นเท่าตอน login · หมดแล้วหน้าเว็บขอใหม่เองด้วย refresh cookie
// สั้นไว้เพราะ access ตรวจด้วยลายเซ็นอย่างเดียว ลบบัญชีหรือเปลี่ยน role แล้วโทเคนเก่ายังใช้ได้จนหมดอายุ
export const ME_ACCESS_TTL_SEC = ACCESS_TTL_SEC

export const REFRESH_COOKIE = 'refresh_token'
export const OAUTH_STATE_COOKIE = 'oauth_state'
export const OAUTH_STATE_PATH = '/auth/google'

// production: SPA อยู่คนละโดเมน ต้อง SameSite=None+Secure · dev: localhost ต่าง port นับเป็น same-site ใช้ Lax
// ทุกค่าที่ไม่ใช่ development นับเป็น production ตรงกับ newEnvironment (APP_ENV ว่าง = production)
const cookieAttrs = (path: string) => {
  const production = (process.env['APP_ENV'] ?? '').trim().toLowerCase() !== 'development'
  return { path, httpOnly: true, sameSite: production ? ('none' as const) : ('lax' as const), secure: production }
}

export function setCookie(res: Response, name: string, value: string, path: string, maxAgeSec: number) {
  res.cookie(name, value, { ...cookieAttrs(path), maxAge: maxAgeSec * 1000 })
}

// ต้องใช้ attribute ชุดเดียวกับตอนตั้ง ไม่งั้นเบราว์เซอร์ไม่ยอมลบ cookie ข้ามโดเมนใน production (logout แล้วไม่หลุด)
export const clearCookie = (res: Response, name: string, path: string) => res.clearCookie(name, cookieAttrs(path))

export const setRefreshCookie = (res: Response, token: string) => setCookie(res, REFRESH_COOKIE, token, '/', REFRESH_TTL_SEC)

export const randomToken = (nBytes: number) => randomBytes(nBytes).toString('base64url')
