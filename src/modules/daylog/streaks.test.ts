import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, weekStart } from './calc.js'
import { badgesOf, dayMet, streakOf, streaksOf, type DayFacts } from './streaks.js'

const fact = (date: string, f: Partial<DayFacts> = {}): DayFacts => ({ date, entries: 0, waterMl: 0, workouts: 0, skinSteps: 0, ...f })

test('addDays crosses month and year ends', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})

test('weekStart is the Monday of that week, Sunday belongs to the week before', () => {
  assert.equal(weekStart('2026-10-19'), '2026-10-19') // จันทร์
  assert.equal(weekStart('2026-10-25'), '2026-10-19') // อาทิตย์
  assert.equal(weekStart('2026-10-22'), '2026-10-19')
})

test('a streak is still alive when today is not done yet, and breaks after a missed day', () => {
  assert.deepEqual(streakOf(['2026-10-16', '2026-10-17', '2026-10-18'], '2026-10-19'), { current: 3, best: 3, days: 3 })
  assert.deepEqual(streakOf(['2026-10-17', '2026-10-18', '2026-10-19'], '2026-10-19'), { current: 3, best: 3, days: 3 })
  assert.equal(streakOf(['2026-10-16', '2026-10-17'], '2026-10-19').current, 0)
})

test('best is the longest run ever and ignores days after today', () => {
  const s = streakOf(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-25'], '2026-10-11')
  assert.deepEqual(s, { current: 2, best: 4, days: 6 })
})

test('water counts only when the day reaches that person’s target', () => {
  assert.equal(dayMet(fact('d', { waterMl: 1999 }), 'water', 2000), false)
  assert.equal(dayMet(fact('d', { waterMl: 2000 }), 'water', 2000), true)
  assert.equal(dayMet(fact('d', { entries: 1 }), 'log', 2000), true)
  assert.equal(dayMet(fact('d', { skinSteps: 1 }), 'skin', 2000), true)
  assert.equal(dayMet(fact('d'), 'workout', 2000), false)
})

test('badges come from the streaks: 7 logged days in a row earns log-3 and log-7 but not log-30', () => {
  const facts = Array.from({ length: 7 }, (_, i) => fact(addDays('2026-10-13', i), { entries: 2 }))
  const badges = badgesOf(streaksOf(facts, '2026-10-19', 2000))
  const byId = Object.fromEntries(badges.map((b) => [b.id, b]))
  assert.equal(byId['first-log']!.earned, true)
  assert.equal(byId['log-7']!.earned, true)
  assert.deepEqual({ ...byId['log-30']! }, { id: 'log-30', progress: 7, goal: 30, earned: false })
  assert.equal(byId['water-7']!.progress, 0)
})
