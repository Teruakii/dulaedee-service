import { addDays } from './calc.js'

// ตัวเลขย่อของหนึ่งวัน ดึงจาก daylog โดยไม่ต้องโหลดรายการอาหารทั้งก้อน
export type DayFacts = { date: string; entries: number; waterMl: number; workouts: number; skinSteps: number }

// สิ่งที่นับเป็น "ทำครบ" ของวันนั้น · ใช้ทั้งวันต่อเนื่องของตัวเองและชาเลนจ์กลุ่ม
export const HABITS = ['log', 'water', 'workout', 'skin'] as const
export type Habit = (typeof HABITS)[number]

export function dayMet(d: DayFacts, habit: Habit, waterTargetMl: number): boolean {
  switch (habit) {
    case 'log':
      return d.entries > 0
    case 'water':
      return d.waterMl >= waterTargetMl
    case 'workout':
      return d.workouts > 0
    case 'skin':
      return d.skinSteps > 0
  }
}

export type Streak = { current: number; best: number; days: number }

// current นับถอยจากวันนี้ ถ้าวันนี้ยังไม่ได้ทำก็ยังไม่ขาด นับจากเมื่อวานแทน
export function streakOf(dates: Iterable<string>, today: string): Streak {
  const set = new Set([...dates].filter((d) => d <= today))
  let current = 0
  for (let d = set.has(today) ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) current++
  let best = 0
  let run = 0
  let prev = ''
  for (const d of [...set].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return { current, best, days: set.size }
}

export type Streaks = Record<Habit, Streak>

export function streaksOf(facts: DayFacts[], today: string, waterTargetMl: number): Streaks {
  return Object.fromEntries(
    HABITS.map((h) => [h, streakOf(facts.filter((f) => dayMet(f, h, waterTargetMl)).map((f) => f.date), today)]),
  ) as Streaks
}

// เหรียญคิดจากสถิติทุกครั้ง ไม่เก็บลงฐานข้อมูล · ลบบันทึกแล้วเหรียญหายตามจริง
// by: best = วันติดกันที่ดีที่สุด, days = จำนวนวันรวม
const BADGES = [
  { id: 'first-log', habit: 'log', by: 'days', goal: 1 },
  { id: 'log-3', habit: 'log', by: 'best', goal: 3 },
  { id: 'log-7', habit: 'log', by: 'best', goal: 7 },
  { id: 'log-30', habit: 'log', by: 'best', goal: 30 },
  { id: 'water-7', habit: 'water', by: 'best', goal: 7 },
  { id: 'workout-10', habit: 'workout', by: 'days', goal: 10 },
  { id: 'skin-14', habit: 'skin', by: 'best', goal: 14 },
] as const satisfies readonly { id: string; habit: Habit; by: 'best' | 'days'; goal: number }[]

export type Badge = { id: (typeof BADGES)[number]['id']; progress: number; goal: number; earned: boolean }

export function badgesOf(s: Streaks): Badge[] {
  return BADGES.map((b) => {
    const progress = Math.min(b.goal, s[b.habit][b.by])
    return { id: b.id, progress, goal: b.goal, earned: progress >= b.goal }
  })
}
