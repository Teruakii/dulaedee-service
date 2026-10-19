import { z } from 'zod'
import { isValidDate } from './calc.js'
import { MEALS, SKIN_SLOTS } from './daylog.model.js'
import { ActivityInput } from '../workout/workout.dto.js'

export const DateParam = z.string().refine(isValidDate, 'INVALID_DATE')
export const SlotParam = z.enum(SKIN_SLOTS)

const Grams = z.number().min(0).max(500)

// เลือกจากฐานเมนู (foodId) หรือกรอกเองเมื่อค้นไม่เจอ (nameTh + kcal) อย่างใดอย่างหนึ่ง
export const AddEntryRequest = z.union([
  z.object({
    meal: z.enum(MEALS),
    qty: z.number().positive().max(20).default(1),
    foodId: z.string().trim().min(1),
  }),
  z.object({
    meal: z.enum(MEALS),
    qty: z.number().positive().max(20).default(1),
    nameTh: z.string().trim().min(1).max(120),
    kcal: z.number().int().min(0).max(5000),
    proteinG: Grams.default(0),
    carbG: Grams.default(0),
    fatG: Grams.default(0),
  }),
])
export type AddEntryRequest = z.infer<typeof AddEntryRequest>

export const AddWaterRequest = z.object({ deltaMl: z.number().int().min(-5000).max(5000) })
export type AddWaterRequest = z.infer<typeof AddWaterRequest>

export const SetWeightRequest = z.object({ weightKg: z.number().min(25).max(300) })
export type SetWeightRequest = z.infer<typeof SetWeightRequest>

export const SetSkinDoneRequest = z.object({ done: z.array(z.string().trim().min(1)).max(30) })
export type SetSkinDoneRequest = z.infer<typeof SetSkinDoneRequest>

// ติ๊กว่าเล่นแล้ว · planItemId ผูกกับตารางเพื่อรู้ว่าข้อไหนในตารางทำแล้ว
export const AddWorkoutRequest = ActivityInput.extend({
  planItemId: z.string().regex(/^[a-f0-9]{24}$/i, 'INVALID_ID').optional(),
})
export type AddWorkoutRequest = z.infer<typeof AddWorkoutRequest>

export const QuickQuery = z.object({ date: DateParam, meal: z.enum(MEALS) })
export type QuickQuery = z.infer<typeof QuickQuery>

// คัดลอกรายการเดิม (snapshot สารอาหารเดิม) มาลงมื้อของวันนี้ · ใช้กับ "กินบ่อย" และ "เหมือนเมื่อวาน"
export const CopyEntriesRequest = z.object({
  meal: z.enum(MEALS),
  from: z.array(z.object({ date: DateParam, entryId: z.string().regex(/^[a-f0-9]{24}$/i, 'INVALID_ID') })).min(1).max(20),
})
export type CopyEntriesRequest = z.infer<typeof CopyEntriesRequest>

export const TodayQuery = z.object({ date: DateParam })

// กราฟหน้าร่างกายขอย้อนหลังได้ไม่เกิน 3 เดือน
export const MAX_RANGE_DAYS = 93
export const RangeQuery = z.object({ from: DateParam, to: DateParam })
export type RangeQuery = z.infer<typeof RangeQuery>
