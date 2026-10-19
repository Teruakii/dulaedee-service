import type { ObjectId } from 'mongodb'

export const COLLECTION = 'push_subscriptions'

// หนึ่งเอกสารต่อเบราว์เซอร์ · endpoint ไม่ซ้ำกัน ผู้ใช้หนึ่งคนมีได้หลายเครื่อง
export type PushSub = {
  _id: ObjectId
  userId: ObjectId
  endpoint: string
  keys: { p256dh: string; auth: string }
  createdAt: Date
}
