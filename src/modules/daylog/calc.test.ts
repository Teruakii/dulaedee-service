import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeTargets } from '../profile/calc.js'
import { byMeal, daysBetween, isValidDate, remainingOf, scaleMacros, sumMacros, todayBangkok } from './calc.js'

const porridge = { meal: 'breakfast' as const, kcal: 250, proteinG: 14, carbG: 30, fatG: 8 }
const chickenRice = { meal: 'lunch' as const, kcal: 596, proteinG: 20, carbG: 72, fatG: 25 }

test('mockup day: 846 eaten, 604 left of 1,450', () => {
  const targets = computeTargets({ sex: 'female', age: 28, heightCm: 160, weightKg: 58, activity: 'light', goal: 'lose' })
  const eaten = sumMacros([porridge, chickenRice])
  assert.equal(eaten.kcal, 846)
  assert.equal(remainingOf(targets, eaten).kcal, 604)
  assert.equal(remainingOf(targets, eaten).proteinG, 59)
})

test('byMeal fills every meal, empty ones are zero', () => {
  const m = byMeal([porridge, chickenRice])
  assert.equal(m.breakfast.kcal, 250)
  assert.equal(m.lunch.kcal, 596)
  assert.deepEqual(m.dinner, { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 })
})

test('scaleMacros: 1.5 plates', () => {
  assert.deepEqual(scaleMacros({ kcal: 580, proteinG: 25, carbG: 70, fatG: 22 }, 1.5), { kcal: 870, proteinG: 37.5, carbG: 105, fatG: 33 })
})

test('dates', () => {
  assert.ok(isValidDate('2026-10-14'))
  assert.ok(!isValidDate('2026-02-30'))
  assert.ok(!isValidDate('14-10-2026'))
  // 20:00 UTC on the 13th is already 03:00 on the 14th in Bangkok
  assert.equal(todayBangkok(new Date('2026-10-13T20:00:00Z')), '2026-10-14')
  assert.equal(daysBetween('2026-10-01', '2026-10-14'), 13)
})
