import { z } from 'zod'
import { ROLES, type Role } from '../../constants/role.js'
import { PageQuery } from '../../infra/http/pagination.js'

// เก็บเป็นตัวพิมพ์เล็ก ไม่ให้ Mind กับ mind เป็นคนละบัญชี
export const Username = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9._-]+$/, 'INVALID_USERNAME')
  .transform((s) => s.toLowerCase())
export const Password = z.string().min(8).max(72) // bcrypt ใช้แค่ 72 byte แรก
const Email = z.email().max(255).transform((e) => e.trim().toLowerCase())

export const CreateUserRequest = z.object({
  username: Username,
  password: Password,
  role: z.enum(ROLES),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).default(''),
  email: Email.optional(),
})
export type CreateUserRequest = z.infer<typeof CreateUserRequest>

export const UpdateUserRequest = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  email: Email.optional(),
})
export type UpdateUserRequest = z.infer<typeof UpdateUserRequest>

export const ListUsersQuery = PageQuery.extend({ role: z.enum(ROLES).optional() })
export type ListUsersQuery = z.infer<typeof ListUsersQuery>

// สิ่งที่ repo บันทึกจริง: รหัสผ่าน hash แล้ว
export type NewUser = {
  username: string
  passwordHash: string
  role: Role
  firstName: string
  lastName: string
  email?: string | undefined
  emailVerified?: boolean
  termsAcceptedAt?: Date
  privacyAcceptedAt?: Date
}
