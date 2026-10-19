import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dueReminders } from './reminders.js'

const all = { water: true, uv: true, skinRoutine: true, clips: true }
const none = { water: false, uv: false, skinRoutine: false, clips: true }
const day = { waterMl: 1000, waterTargetMl: 1900, skinPmDone: 0, uvMax: 8.4 }

test('water every 2 hours while short of the target, with glasses left', () => {
  const [r] = dueReminders(11, all, day)
  assert.equal(r!.kind, 'water')
  assert.equal(r!.body, 'วันนี้ดื่มไป 4 แก้ว ขาดอีก 4 แก้ว')
  assert.deepEqual(dueReminders(12, all, day), [])
})

test('no water reminder once the target is met', () => {
  assert.deepEqual(dueReminders(11, all, { ...day, waterMl: 2000 }), [])
})

test('UV at 8:00 only when the max is high, and skipped when weather is unknown', () => {
  assert.equal(dueReminders(8, all, day)[0]!.title, 'วันนี้ UV สูงถึง 8')
  assert.deepEqual(dueReminders(8, all, { ...day, uvMax: 5.9 }), [])
  assert.deepEqual(dueReminders(8, all, { ...day, uvMax: undefined }), [])
})

test('skin routine at 22:00 only if nothing ticked tonight', () => {
  assert.equal(dueReminders(22, all, day)[0]!.kind, 'skin')
  assert.deepEqual(dueReminders(22, all, { ...day, skinPmDone: 1 }), [])
})

test('switched-off reminders never fire', () => {
  for (const h of [8, 11, 22]) assert.deepEqual(dueReminders(h, none, day), [])
})
