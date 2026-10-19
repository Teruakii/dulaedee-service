import { z } from 'zod'
import { DateParam } from '../daylog/daylog.dto.js'
import { HABITS } from '../daylog/streaks.js'

export const CodeParam = z.string().trim().regex(/^[A-Za-z0-9_-]{6,32}$/, 'INVITE_INVALID')

export const UpsertGroupRequest = z.object({
  name: z.string().trim().min(1).max(40),
  challenge: z.enum(HABITS),
})
export type UpsertGroupRequest = z.infer<typeof UpsertGroupRequest>

export const JoinRequest = z.object({ code: CodeParam })

// "วันนี้" ของผู้ใช้มาจาก client เหมือน daylog · บอกว่าอยู่สัปดาห์ไหน
export const BoardQuery = z.object({ date: DateParam })
