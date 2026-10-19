import type { ObjectId } from 'mongodb'

export const PLANS_COLLECTION = 'workout_plans'

// จันทร์ = 0 ถึง อาทิตย์ = 6 ตามปฏิทินไทยที่เริ่มสัปดาห์วันจันทร์
export const WEEKDAY_COUNT = 7

// ผู้ใช้กรอกเองทั้งหมด · kcal ใส่เมื่อรู้ (เช่น จากนาฬิกา) ไม่ใส่ก็ไม่นับ
export type Activity = { name: string; minutes: number; kcal?: number }

export type PlanItem = Activity & { id: ObjectId }

export type WorkoutPlan = {
  _id: ObjectId
  userId: ObjectId
  days: PlanItem[][]
  createdAt: Date
  updatedAt: Date
}

export type PlanItemResponse = Activity & { id: string }
export type PlanResponse = { days: PlanItemResponse[][] }
