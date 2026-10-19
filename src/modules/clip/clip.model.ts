import type { ObjectId } from 'mongodb'
import type { FoodTag } from '../food/food.model.js'

export const COLLECTION = 'clips'

// คลิปที่ทีมโภชนาการคัดเองแล้วผูกกับเมนู ไม่ค้นสดจาก YouTube (ไม่ต้องใช้ API key และคุมคุณภาพได้)
export type Clip = {
  _id: ObjectId
  youtubeId: string
  title: string
  channel: string
  durationSec: number
  foodIds: ObjectId[]
  tags: FoodTag[]
  createdAt: Date
  updatedAt: Date
}

export type ClipResponse = Omit<Clip, '_id' | 'foodIds'> & { id: string; foodIds: string[]; thumbnailUrl: string; watchUrl: string }

export const toResponse = ({ _id, foodIds, ...rest }: Clip): ClipResponse => ({
  id: _id.toHexString(),
  ...rest,
  foodIds: foodIds.map((f) => f.toHexString()),
  thumbnailUrl: `https://i.ytimg.com/vi/${rest.youtubeId}/hqdefault.jpg`,
  watchUrl: `https://www.youtube.com/watch?v=${rest.youtubeId}`,
})
