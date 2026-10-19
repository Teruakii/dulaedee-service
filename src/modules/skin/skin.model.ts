import type { ObjectId } from 'mongodb'
import type { SkinSlot } from '../daylog/daylog.model.js'

export const PRODUCTS_COLLECTION = 'skin_products'

// ลำดับใน array คือลำดับทาโดยปกติ ใช้เรียงเมื่อผู้ใช้ยังไม่จัดเอง
export const STEPS = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'sunscreen', 'other'] as const
export type SkinStep = (typeof STEPS)[number]

export const ACTIVES = ['retinol', 'aha', 'bha', 'vitamin_c', 'niacinamide', 'benzoyl_peroxide', 'hyaluronic_acid', 'spf'] as const
export type Active = (typeof ACTIVES)[number]

// ผลิตภัณฑ์ของผู้ใช้แต่ละคน ไม่ใช่ฐานข้อมูลกลาง · slots = อยู่ใน routine เช้า/ก่อนนอน
export type SkinProduct = {
  _id: ObjectId
  userId: ObjectId
  name: string
  step: SkinStep
  actives: Active[]
  slots: SkinSlot[]
  order: Record<SkinSlot, number>
  createdAt: Date
  updatedAt: Date
}

export type SkinProductResponse = Omit<SkinProduct, '_id' | 'userId'> & { id: string }

export const toProductResponse = ({ _id, userId: _u, ...rest }: SkinProduct): SkinProductResponse => ({ id: _id.toHexString(), ...rest })
