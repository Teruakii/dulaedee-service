import type { ObjectId } from 'mongodb'

export const COLLECTION = 'foods'

// หน่วยแบบไทย · ป้ายภาษาไทยอยู่ฝั่ง frontend
export const UNITS = ['plate', 'bowl', 'ladle', 'piece', 'glass', 'skewer', 'pack', 'serving'] as const
export type Unit = (typeof UNITS)[number]

export const FOOD_TAGS = [
  'one_dish',
  'side_dish',
  'soup',
  'salad',
  'high_protein',
  'no_rice',
  'street_food',
  'drink',
  'snack',
  'breakfast',
] as const
export type FoodTag = (typeof FOOD_TAGS)[number]

// สารอาหารต่อ 1 หน่วย · verified=false คือค่าประมาณที่ยังไม่ได้เทียบตาราง INMUCAL
export type Food = {
  _id: ObjectId
  nameTh: string
  unit: Unit
  kcal: number
  proteinG: number
  carbG: number
  fatG: number
  tags: FoodTag[]
  verified: boolean
  // ไม่มี = เมนูกลางที่ทุกคนเห็น · มี = เมนูที่สมาชิกเพิ่มเอง เห็นและลบได้เฉพาะเจ้าของ
  ownerId?: ObjectId
  createdAt: Date
  updatedAt: Date
}

export type FoodResponse = Omit<Food, '_id' | 'ownerId'> & { id: string; personal: boolean }

export const toResponse = ({ _id, ownerId, ...rest }: Food): FoodResponse => ({ id: _id.toHexString(), personal: ownerId !== undefined, ...rest })
