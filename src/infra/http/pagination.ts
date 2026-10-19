import { z } from 'zod'

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type PageQuery = z.infer<typeof PageQuery>

// ดึงเกินมา 1 แถวเพื่อรู้ว่ามีหน้าถัดไปไหม
export function sliceHasMore<T>(rows: T[], limit: number): { rows: T[]; hasMore: boolean } {
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}
