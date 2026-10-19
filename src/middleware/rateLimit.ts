import { rateLimit } from 'express-rate-limit'

const MIN = 60 * 1000

// นับต่อ IP ในหน่วยความจำของ process · รันหลาย instance ต้องเปลี่ยน store เป็น Redis
const limit = (windowMs: number, limit: number, extra: { skipSuccessfulRequests?: boolean } = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ code: 429, message: 'TOO_MANY_REQUESTS' }),
    ...extra,
  })

// ทั้ง API: กันยิงถล่ม
export const apiLimit = limit(5 * MIN, 600)
// login: นับเฉพาะครั้งที่ผิด กันเดารหัส แต่คนที่ login สำเร็จบ่อยไม่โดน
export const loginLimit = limit(15 * MIN, 20, { skipSuccessfulRequests: true })
// เปลี่ยน/ตั้งรหัสผ่านใหม่: กันเดารหัสเดิมและโทเคนรีเซ็ต
export const passwordLimit = limit(15 * MIN, 10, { skipSuccessfulRequests: true })
export const registerLimit = limit(60 * MIN, 10)
// ส่งอีเมล: กันใช้เป็นเครื่องยิงอีเมลใส่คนอื่น
export const forgotLimit = limit(60 * MIN, 5)
