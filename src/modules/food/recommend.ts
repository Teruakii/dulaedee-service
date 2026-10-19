import type { Food, FoodTag } from './food.model.js'

type Nutrition = Pick<Food, 'kcal' | 'proteinG' | 'tags'>

// เมนูที่เล็กกว่าสัดส่วนนี้ของงบที่เหลือไม่นับเป็นมื้อ (เช่นข้าวสวยทัพพีเดียว)
export const MIN_MEAL_SHARE = 0.25
// แนะนำเฉพาะสิ่งที่กินเป็นมื้อได้ ไม่ใช่กับข้าวเดี่ยวอย่างอกไก่หรือไก่ย่างไม้เดียว
export const MEAL_TAGS: ReadonlySet<FoodTag> = new Set(['one_dish', 'soup', 'salad'])

// คัดเมนูที่ไม่เกินงบที่เหลือ · ยังขาดโปรตีน = เรียงตามโปรตีนต่อแคลอรี่ · ไม่ขาด = เรียงตามความใกล้งบ
export function rankMenus<T extends Nutrition>(foods: T[], remainingKcal: number, proteinGapG: number, limit: number): T[] {
  const minKcal = remainingKcal * MIN_MEAL_SHARE
  const score = (f: T) => (proteinGapG > 0 ? f.proteinG / Math.max(f.kcal, 1) : f.kcal / Math.max(remainingKcal, 1))
  return foods
    .filter((f) => f.kcal > 0 && f.kcal <= remainingKcal && f.kcal >= minKcal && f.tags.some((t) => MEAL_TAGS.has(t)))
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
}
