import type { ObjectId } from 'mongodb'
import type { Role } from '../../constants/role.js'

export const COLLECTION = 'users'

export type User = {
  _id: ObjectId
  username: string
  password: string
  role: Role
  isActive: boolean
  firstName: string
  lastName: string
  email?: string
  // ยืนยันแล้วว่าเจ้าของอีเมลเป็นคนใช้บัญชีนี้ (กดลิงก์ในอีเมล, login ด้วย Google หรือ admin สร้างให้)
  emailVerifiedAt?: Date
  // เวลาที่ยอมรับข้อกำหนด / นโยบายความเป็นส่วนตัว (ตอนสมัครเอง)
  termsAcceptedAt?: Date
  privacyAcceptedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type UserResponse = {
  id: string
  username: string
  role: Role
  firstName: string
  lastName: string
  email?: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

// ข้อมูลสำหรับตรวจรหัสผ่าน ห้ามส่งออกไปนอก auth
export type UserAuth = { id: string; username: string; password: string; role: Role; email?: string; emailVerified: boolean }

export function toResponse(u: User): UserResponse {
  return {
    id: u._id.toHexString(),
    username: u.username,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
    ...(u.email ? { email: u.email } : {}),
    emailVerified: Boolean(u.emailVerifiedAt),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }
}
