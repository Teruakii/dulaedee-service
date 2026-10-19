import { z } from 'zod'
import { PageQuery } from '../../infra/http/pagination.js'
import { FOOD_TAGS } from '../food/food.model.js'

// id วิดีโอ YouTube ยาว 11 ตัว · รับลิงก์เต็มก็ได้ แล้วดึง id ออกมา
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const YoutubeId = z
  .string()
  .trim()
  .transform((s) => {
    if (YOUTUBE_ID.test(s)) return s
    try {
      const u = new URL(s)
      return (u.hostname.endsWith('youtu.be') ? u.pathname.slice(1) : u.searchParams.get('v')) ?? ''
    } catch {
      return ''
    }
  })
  .pipe(z.string().regex(YOUTUBE_ID, 'INVALID_YOUTUBE_ID'))

const ObjectIdString = z.string().regex(/^[a-f0-9]{24}$/i, 'INVALID_ID')

export const UpsertClipRequest = z.object({
  youtubeId: YoutubeId,
  title: z.string().trim().min(1).max(200),
  channel: z.string().trim().min(1).max(120),
  durationSec: z.number().int().min(1).max(6 * 3600),
  foodIds: z.array(ObjectIdString).max(50).default([]),
  tags: z.array(z.enum(FOOD_TAGS)).max(FOOD_TAGS.length).default([]),
})
export type UpsertClipRequest = z.infer<typeof UpsertClipRequest>

export const ListClipsQuery = PageQuery.extend({
  foodId: ObjectIdString.optional(),
  tag: z.enum(FOOD_TAGS).optional(),
})
export type ListClipsQuery = z.infer<typeof ListClipsQuery>

// หน้าวันนี้ส่ง id เมนูที่ถูกแนะนำมา คั่นด้วย comma
export const RecommendClipsQuery = z.object({
  foodIds: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(ObjectIdString).max(20)),
  limit: z.coerce.number().int().min(1).max(12).default(4),
})
export type RecommendClipsQuery = z.infer<typeof RecommendClipsQuery>
