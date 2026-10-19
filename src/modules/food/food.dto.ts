import { z } from 'zod'
import { PageQuery } from '../../infra/http/pagination.js'
import { FOOD_TAGS, UNITS } from './food.model.js'

const Grams = z.number().min(0).max(500)

export const UpsertFoodRequest = z.object({
  nameTh: z.string().trim().min(1).max(120),
  unit: z.enum(UNITS),
  kcal: z.number().int().min(0).max(5000),
  proteinG: Grams,
  carbG: Grams,
  fatG: Grams,
  tags: z.array(z.enum(FOOD_TAGS)).max(FOOD_TAGS.length).default([]),
  verified: z.boolean().default(false),
})
export type UpsertFoodRequest = z.infer<typeof UpsertFoodRequest>

// เมนูที่สมาชิกเพิ่มเอง ยังไม่มีใครตรวจค่า จึงไม่รับ verified
export const CreateMyFoodRequest = UpsertFoodRequest.omit({ verified: true }).extend({ unit: z.enum(UNITS).default('serving') })
export type CreateMyFoodRequest = z.infer<typeof CreateMyFoodRequest>

export const ListFoodsQuery = PageQuery.extend({
  q: z.string().trim().max(60).optional(),
  tag: z.enum(FOOD_TAGS).optional(),
  mine: z.stringbool().optional(),
})
export type ListFoodsQuery = z.infer<typeof ListFoodsQuery>

export const RecommendQuery = z.object({
  remainingKcal: z.coerce.number().int().min(0).max(5000),
  proteinGapG: z.coerce.number().min(0).max(500).default(0),
  limit: z.coerce.number().int().min(1).max(20).default(3),
})
export type RecommendQuery = z.infer<typeof RecommendQuery>
