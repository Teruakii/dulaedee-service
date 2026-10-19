import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ObjectId } from 'mongodb'
import type { DayLog, Entry, Meal } from './daylog.model.js'
import { frequentFoods, mealOf } from './quick.js'

const rice = new ObjectId()
const egg = new ObjectId()

const entry = (meal: Meal, nameTh: string, foodId?: ObjectId, qty = 1): Entry => ({
  id: new ObjectId(),
  meal,
  ...(foodId ? { foodId } : {}),
  nameTh,
  qty,
  kcal: 100 * qty,
  proteinG: 5 * qty,
  carbG: 0,
  fatG: 0,
  createdAt: new Date(),
})

const day = (date: string, entries: Entry[]): DayLog => ({
  _id: new ObjectId(),
  userId: new ObjectId(),
  date,
  entries,
  waterMl: 0,
  skinDone: { am: [], pm: [] },
  createdAt: new Date(),
  updatedAt: new Date(),
})

test('frequent foods rank what is eaten at this meal above the same count at other meals', () => {
  const logs = [
    day('2026-10-17', [entry('breakfast', 'ไข่ต้ม', egg), entry('lunch', 'ข้าวมันไก่', rice)]),
    day('2026-10-18', [entry('breakfast', 'ไข่ต้ม', egg), entry('lunch', 'ข้าวมันไก่', rice)]),
  ]
  assert.deepEqual(frequentFoods(logs, 'lunch').map((f) => f.nameTh), ['ข้าวมันไก่', 'ไข่ต้ม'])
  assert.deepEqual(frequentFoods(logs, 'breakfast').map((f) => f.nameTh), ['ไข่ต้ม', 'ข้าวมันไก่'])
})

test('a frequent food points at its latest entry, so re-adding keeps the recent portion', () => {
  const latest = entry('lunch', 'ข้าวมันไก่', rice, 1.5)
  const logs = [day('2026-10-18', [latest]), day('2026-10-10', [entry('lunch', 'ข้าวมันไก่', rice, 1)])]
  const [f] = frequentFoods(logs, 'lunch')
  assert.equal(f!.count, 2)
  assert.equal(f!.qty, 1.5)
  assert.equal(f!.date, '2026-10-18')
  assert.equal(f!.entryId, latest.id.toHexString())
})

test('typed-in foods group by name, and the list stops at the limit', () => {
  const logs = [day('2026-10-18', Array.from({ length: 12 }, (_, i) => entry('snack', `ขนม ${i}`)).concat(entry('snack', 'ขนม 0')))]
  const out = frequentFoods(logs, 'snack', 8)
  assert.equal(out.length, 8)
  assert.equal(out[0]!.nameTh, 'ขนม 0')
  assert.equal(out[0]!.count, 2)
})

test('mealOf keeps only that meal from the given day', () => {
  const d = day('2026-10-18', [entry('breakfast', 'โจ๊ก'), entry('lunch', 'กะเพรา')])
  assert.deepEqual(mealOf(d, 'lunch').map((f) => f.nameTh), ['กะเพรา'])
  assert.deepEqual(mealOf(null, 'lunch'), [])
})
