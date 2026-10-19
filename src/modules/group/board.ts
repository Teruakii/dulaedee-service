import { addDays } from '../daylog/calc.js'
import { dayMet, type DayFacts, type Habit } from '../daylog/streaks.js'
import type { BoardRow } from './group.model.js'

export type BoardMember = { userId: string; firstName: string; facts: DayFacts[]; waterTargetMl: number }

// สัปดาห์จันทร์ถึงอาทิตย์ · วันที่ยังมาไม่ถึงเป็น false เสมอ · มากสุดขึ้นก่อน เท่ากันเรียงตามชื่อ
export function boardOf(members: BoardMember[], challenge: Habit, from: string, today: string, me: string, ownerId: string): BoardRow[] {
  const week = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  return members
    .map((m) => {
      const met = new Set(m.facts.filter((f) => dayMet(f, challenge, m.waterTargetMl)).map((f) => f.date))
      const days = week.map((d) => d <= today && met.has(d))
      return { userId: m.userId, firstName: m.firstName, isMe: m.userId === me, isOwner: m.userId === ownerId, days, count: days.filter(Boolean).length }
    })
    .sort((a, b) => b.count - a.count || a.firstName.localeCompare(b.firstName, 'th'))
}
