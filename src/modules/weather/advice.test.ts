import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HourlyForecast } from '../../infra/weather/openmeteo.js'
import { summarize, uvLevelOf } from './advice.js'

const hours = (date: string, uv: number[], rh: number[]) => ({
  time: uv.map((_, i) => `${date}T${String(i).padStart(2, '0')}:00`),
  uv_index: uv,
  relative_humidity_2m: rh,
})

function forecast(): HourlyForecast {
  const today = hours('2026-10-14', [0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 7, 8, 9, 9, 8, 6, 3, 1, 0, 0, 0, 0, 0, 0], Array(24).fill(78))
  const tomorrow = hours('2026-10-15', [0, 0, 0, 0, 0, 0, 0, 1, 3, 6, 8, 10, 10, 9, 7, 5, 2, 1, 0, 0, 0, 0, 0, 0], Array(24).fill(80))
  return {
    time: [...today.time, ...tomorrow.time],
    uv_index: [...today.uv_index, ...tomorrow.uv_index],
    relative_humidity_2m: [...today.relative_humidity_2m, ...tomorrow.relative_humidity_2m],
  }
}

test('mockup afternoon: UV 9 very high, humidity 78%', () => {
  const s = summarize(forecast(), '2026-10-14T14:00')
  assert.deepEqual(s.now, { time: '2026-10-14T14:00', uvIndex: 8, humidityPct: 78 })
  assert.deepEqual(s.today, { date: '2026-10-14', uvMax: 9, uvMaxTime: '2026-10-14T12:00', uvLevel: 'very_high' })
  assert.deepEqual(s.tomorrow, { date: '2026-10-15', uvMax: 10, uvLevel: 'very_high' })
  assert.deepEqual(s.advice, ['SUNSCREEN_SPF50', 'REAPPLY_SUNSCREEN_2H', 'DRINK_MORE_WATER', 'GEL_MOISTURIZER'])
})

test('WHO UV bands', () => {
  assert.equal(uvLevelOf(2.9), 'low')
  assert.equal(uvLevelOf(3), 'moderate')
  assert.equal(uvLevelOf(7.9), 'high')
  assert.equal(uvLevelOf(10), 'very_high')
  assert.equal(uvLevelOf(11), 'extreme')
})
