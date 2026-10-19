import type { DayLog, Entry, Meal } from './daylog.model.js'

// เมนูที่กดเพิ่มซ้ำได้ทันที · date + entryId ชี้รายการต้นทางที่จะคัดลอก
export type QuickItem = {
  date: string
  entryId: string
  foodId?: string
  nameTh: string
  unit?: Entry['unit']
  qty: number
  kcal: number
  proteinG: number
  count: number
}

const toItem = (date: string, e: Entry, count = 1): QuickItem => ({
  date,
  entryId: e.id.toHexString(),
  ...(e.foodId ? { foodId: e.foodId.toHexString() } : {}),
  nameTh: e.nameTh,
  ...(e.unit ? { unit: e.unit } : {}),
  qty: e.qty,
  kcal: e.kcal,
  proteinG: e.proteinG,
  count,
})

export const FREQUENT_LIMIT = 8

// เมนูเดียวกัน = foodId เดียวกัน หรือชื่อเดียวกันถ้ากรอกเอง · ที่กินมื้อนี้บ่อยได้คะแนนเพิ่ม
// ตัวแทนคือครั้งล่าสุด จะได้ปริมาณที่กินช่วงหลัง
export function frequentFoods(logs: DayLog[], meal: Meal, limit = FREQUENT_LIMIT): QuickItem[] {
  const groups = new Map<string, { date: string; latest: Entry; count: number; score: number }>()
  for (const log of [...logs].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of log.entries) {
      const key = e.foodId ? e.foodId.toHexString() : `name:${e.nameTh}`
      const g = groups.get(key) ?? { date: log.date, latest: e, count: 0, score: 0 }
      g.count++
      g.score += e.meal === meal ? 2 : 1
      g.date = log.date
      g.latest = e
      groups.set(key, g)
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((g) => toItem(g.date, g.latest, g.count))
}

export function mealOf(log: DayLog | null, meal: Meal): QuickItem[] {
  return (log?.entries ?? []).filter((e) => e.meal === meal).map((e) => toItem(log!.date, e))
}
