import { createHmac, timingSafeEqual } from 'node:crypto'

// โทเคนในลิงก์อีเมลแบบไม่ต้องเก็บในฐานข้อมูล: userId.หมดอายุ.ลายเซ็น
// ลายเซ็นผูกกับค่าปัจจุบันของบัญชี (binding) ค่านั้นเปลี่ยนแล้วโทเคนเดิมใช้ไม่ได้ทันที
// รีเซ็ตรหัสผ่านผูกกับ hash รหัสผ่าน จึงใช้ได้ครั้งเดียว · ยืนยันอีเมลผูกกับอีเมล เปลี่ยนอีเมลแล้วลิงก์เก่าตาย
type Purpose = 'reset' | 'verify-email'

export const RESET_TTL_MIN = 30
export const VERIFY_TTL_MIN = 24 * 60

const sign = (purpose: Purpose, secret: string, userId: string, exp: number, binding: string) =>
  createHmac('sha256', secret).update(`${purpose}|${userId}|${exp}|${binding}`).digest('base64url')

const make = (purpose: Purpose, ttlMin: number) => (secret: string, userId: string, binding: string, now = Date.now()) => {
  const exp = Math.floor(now / 1000) + ttlMin * 60
  return `${userId}.${exp}.${sign(purpose, secret, userId, exp, binding)}`
}

/** แยก userId ออกมาก่อน เพื่อไปอ่านค่าปัจจุบันของบัญชีมาตรวจ · รูปแบบผิดได้ null */
export function tokenUser(token: string): { userId: string; exp: number; sig: string } | null {
  const [userId, expStr, sig] = token.split('.')
  const exp = Number(expStr)
  if (!userId || !/^[a-f0-9]{24}$/i.test(userId) || !Number.isInteger(exp) || !sig) return null
  return { userId, exp, sig }
}

const verify = (purpose: Purpose) => (secret: string, token: string, binding: string, now = Date.now()) => {
  const t = tokenUser(token)
  if (!t || t.exp * 1000 < now) return false
  const want = Buffer.from(sign(purpose, secret, t.userId, t.exp, binding))
  const got = Buffer.from(t.sig)
  return want.length === got.length && timingSafeEqual(want, got)
}

export const makeResetToken = make('reset', RESET_TTL_MIN)
export const verifyResetToken = verify('reset')
export const makeVerifyEmailToken = make('verify-email', VERIFY_TTL_MIN)
export const verifyEmailToken = verify('verify-email')
