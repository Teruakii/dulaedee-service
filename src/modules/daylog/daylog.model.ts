import type { ObjectId } from 'mongodb'
import type { Unit } from '../food/food.model.js'
import type { Activity } from '../workout/workout.model.js'
import type { Targets } from '../profile/calc.js'

export const COLLECTION = 'daylogs'

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type Meal = (typeof MEALS)[number]

export const SKIN_SLOTS = ['am', 'pm'] as const
export type SkinSlot = (typeof SKIN_SLOTS)[number]

export type Macros = { kcal: number; proteinG: number; carbG: number; fatG: number }

// สารอาหารคูณ qty แล้ว snapshot ไว้ตอนบันทึก แก้ฐานเมนูภายหลังไม่ย้อนเปลี่ยนประวัติ
export type Entry = Macros & {
  id: ObjectId
  meal: Meal
  foodId?: ObjectId
  nameTh: string
  unit?: Unit
  qty: number
  createdAt: Date
}

// สิ่งที่เล่นแล้ว · คัดลอกจากตารางตอนติ๊ก แก้ตารางทีหลังก็ไม่กระทบวันที่ผ่านมา
export type WorkoutLog = Activity & {
  id: ObjectId
  planItemId?: ObjectId
  createdAt: Date
}

// หนึ่งเอกสารต่อผู้ใช้ต่อวัน · date เป็น YYYY-MM-DD ตามเวลาไทย
export type DayLog = {
  _id: ObjectId
  userId: ObjectId
  date: string
  entries: Entry[]
  waterMl: number
  weightKg?: number
  skinDone: Record<SkinSlot, string[]>
  // เอกสารก่อนมีฟีเจอร์ออกกำลังกายไม่มีฟิลด์นี้
  workouts?: WorkoutLog[]
  createdAt: Date
  updatedAt: Date
}

export type WorkoutLogResponse = Omit<WorkoutLog, 'id' | 'planItemId'> & { id: string; planItemId?: string }

export type EntryResponse = Omit<Entry, 'id' | 'foodId'> & { id: string; foodId?: string }

export type DaySummary = {
  date: string
  entries: EntryResponse[]
  totals: Macros
  byMeal: Record<Meal, Macros>
  waterMl: number
  weightKg?: number
  skinDone: Record<SkinSlot, string[]>
  workouts: WorkoutLogResponse[]
  // แสดงอย่างเดียว ไม่บวกกลับเข้างบ เพราะงบคิดรวมระดับกิจกรรมไว้แล้ว
  burned: { kcal: number; minutes: number }
  // null เมื่อผู้ใช้ยังไม่ได้ตั้งข้อมูลร่างกาย
  targets: Targets | null
  remaining: Macros | null
}

export type RangePoint = { date: string; kcal: number; proteinG: number; entries: number; waterMl: number; weightKg?: number; skinAm: number; skinPm: number; workoutMin: number; burnedKcal: number }
