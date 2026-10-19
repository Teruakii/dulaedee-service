import { z } from 'zod'
import { ACTIVITIES, GOALS, SEXES } from './calc.js'
import { SKIN_CONCERNS, SKIN_TYPES } from './profile.model.js'

const Height = z.number().min(100).max(250)
const Weight = z.number().min(25).max(300)

export const UpsertProfileRequest = z.object({
  sex: z.enum(SEXES),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear() - 13),
  heightCm: Height,
  weightKg: Weight,
  activity: z.enum(ACTIVITIES),
  goal: z.enum(GOALS),
  skinType: z.enum(SKIN_TYPES).optional(),
  skinConcerns: z.array(z.enum(SKIN_CONCERNS)).max(SKIN_CONCERNS.length).default([]),
})
export type UpsertProfileRequest = z.infer<typeof UpsertProfileRequest>

export const UpdateNotifyRequest = z
  .object({ water: z.boolean(), uv: z.boolean(), skinRoutine: z.boolean() })
  .partial()
export type UpdateNotifyRequest = z.infer<typeof UpdateNotifyRequest>

// เครื่องคำนวณรับอายุตรงๆ ไม่ต้อง login
export const CalcRequest = z.object({
  sex: z.enum(SEXES),
  age: z.number().int().min(13).max(120),
  heightCm: Height,
  weightKg: Weight,
  activity: z.enum(ACTIVITIES),
  goal: z.enum(GOALS),
})
export type CalcRequest = z.infer<typeof CalcRequest>
