import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { DayFacts } from '../daylog/streaks.js'
import { boardOf } from './board.js'

const fact = (date: string, f: Partial<DayFacts> = {}): DayFacts => ({ date, entries: 0, waterMl: 0, workouts: 0, skinSteps: 0, ...f })

test('the board marks Monday to Sunday, sorts by days done, and never counts days after today', () => {
  const members = [
    { userId: 'a', firstName: 'แอน', waterTargetMl: 2000, facts: [fact('2026-10-19', { waterMl: 2000 })] },
    {
      userId: 'b',
      firstName: 'บี',
      waterTargetMl: 2500,
      // วันพุธยังมาไม่ถึง ไม่นับแม้มีข้อมูล · วันอังคารไม่ถึงเป้าของบีเอง
      facts: [fact('2026-10-19', { waterMl: 2600 }), fact('2026-10-20', { waterMl: 2400 }), fact('2026-10-21', { waterMl: 3000 })],
    },
    { userId: 'c', firstName: 'ซี', waterTargetMl: 1800, facts: [fact('2026-10-19', { waterMl: 1900 }), fact('2026-10-20', { waterMl: 1800 })] },
  ]
  const rows = boardOf(members, 'water', '2026-10-19', '2026-10-20', 'a', 'c')
  assert.deepEqual(rows.map((r) => [r.firstName, r.count]), [['ซี', 2], ['บี', 1], ['แอน', 1]])
  assert.deepEqual(rows[0]!.days, [true, true, false, false, false, false, false])
  assert.equal(rows[0]!.isOwner, true)
  assert.equal(rows.find((r) => r.isMe)!.firstName, 'แอน')
})
