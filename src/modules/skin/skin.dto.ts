import { z } from 'zod'
import { SKIN_SLOTS } from '../daylog/daylog.model.js'
import { ACTIVES, STEPS } from './skin.model.js'

export const UpsertProductRequest = z.object({
  name: z.string().trim().min(1).max(120),
  step: z.enum(STEPS),
  actives: z.array(z.enum(ACTIVES)).max(ACTIVES.length).default([]),
  slots: z.array(z.enum(SKIN_SLOTS)).max(2).default([]),
})
export type UpsertProductRequest = z.infer<typeof UpsertProductRequest>

export const ReorderRequest = z.object({ productIds: z.array(z.string().trim().min(1)).min(1).max(30) })
export type ReorderRequest = z.infer<typeof ReorderRequest>
