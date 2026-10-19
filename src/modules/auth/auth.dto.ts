import { z } from 'zod'
import type { UserResponse } from '../user/user.model.js'
import { Password, Username } from '../user/user.dto.js'

// username หรือ email ก็ได้ (หน้า login ใน mockup กรอกอีเมล)
export const LoginRequest = z.object({
  username: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(1),
})
export type LoginRequest = z.infer<typeof LoginRequest>

// สมัครเองได้ role MEMBER แล้ว login ให้ทันที ต้องยอมรับข้อกำหนด + นโยบายความเป็นส่วนตัว
export const RegisterRequest = z.object({
  username: Username,
  password: Password,
  email: z.email().max(255).transform((e) => e.trim().toLowerCase()),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).default(''),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
})
export type RegisterRequest = z.infer<typeof RegisterRequest>

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1),
  newPassword: Password,
})
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>

export const AdminResetPasswordRequest = z.object({ newPassword: Password })
export const ForgotPasswordRequest = z.object({ email: z.string().trim().toLowerCase().email().max(254) })
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequest>
export const ResetPasswordRequest = z.object({ token: z.string().min(1).max(200), newPassword: Password })
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequest>
export type AdminResetPasswordRequest = z.infer<typeof AdminResetPasswordRequest>

export const VerifyEmailRequest = z.object({ token: z.string().min(1).max(200) })
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequest>

export type TokenResponse = { accessToken: string }

// accessToken มีค่าเฉพาะตอนออก access ใหม่จาก refresh
export type MeResponse = { user: UserResponse; accessToken?: string }
