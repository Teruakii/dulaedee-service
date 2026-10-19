import { z } from 'zod'

export const ActivityInput = z.object({
  name: z.string().trim().min(1).max(60),
  // ไม่เกิน 5 ชม. ต่อรายการ
  minutes: z.number().int().min(1).max(300),
  kcal: z.number().int().min(0).max(3000).optional(),
})
export type ActivityInput = z.infer<typeof ActivityInput>

export const SetDayRequest = z.object({ items: z.array(ActivityInput).max(12) })
export type SetDayRequest = z.infer<typeof SetDayRequest>

export const WeekdayParam = z.coerce.number().int().min(0).max(6)
