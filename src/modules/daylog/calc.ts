import type { Targets } from '../profile/calc.js'
import { MEALS, type Macros, type Meal } from './daylog.model.js'

export const ZERO: Macros = { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 }

const round1 = (n: number) => Math.round(n * 10) / 10

export function sumMacros(items: Macros[]): Macros {
  const t = items.reduce(
    (acc, m) => ({ kcal: acc.kcal + m.kcal, proteinG: acc.proteinG + m.proteinG, carbG: acc.carbG + m.carbG, fatG: acc.fatG + m.fatG }),
    ZERO,
  )
  return { kcal: Math.round(t.kcal), proteinG: round1(t.proteinG), carbG: round1(t.carbG), fatG: round1(t.fatG) }
}

export function scaleMacros(per: Macros, qty: number): Macros {
  return { kcal: Math.round(per.kcal * qty), proteinG: round1(per.proteinG * qty), carbG: round1(per.carbG * qty), fatG: round1(per.fatG * qty) }
}

export function byMeal(entries: (Macros & { meal: Meal })[]): Record<Meal, Macros> {
  return Object.fromEntries(MEALS.map((m) => [m, sumMacros(entries.filter((e) => e.meal === m))])) as Record<Meal, Macros>
}

// ติดลบได้ เมื่อกินเกินงบ · หน้าจอเลือกเองว่าจะแสดงอย่างไร (ไม่ขึ้นสีแดงตามที่ออกแบบไว้)
export function remainingOf(targets: Targets, eaten: Macros): Macros {
  return {
    kcal: targets.kcal - eaten.kcal,
    proteinG: round1(targets.proteinG - eaten.proteinG),
    carbG: round1(targets.carbG - eaten.carbG),
    fatG: round1(targets.fatG - eaten.fatG),
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

// วันที่ตามเวลาไทย (UTC+7 ไม่มี daylight saving)
export function todayBangkok(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

// วันจันทร์ของสัปดาห์ที่มีวันนั้น · ชาเลนจ์กลุ่มนับจันทร์ถึงอาทิตย์
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, -((dow + 6) % 7))
}
