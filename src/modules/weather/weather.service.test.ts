import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HourlyForecast } from '../../infra/weather/openmeteo.js'
import { WeatherService } from './weather.service.js'

// service สรุปเฉพาะชั่วโมงของวันนี้ตามเวลาไทย ข้อมูลตัวอย่างจึงต้องเป็นวันนี้ ไม่ใช่วันที่ตายตัว
const todayBangkok = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 10)
const hourly: HourlyForecast = { time: [`${todayBangkok}T12:00`], uv_index: [9], relative_humidity_2m: [78] }

test('concurrent requests for the same area share one upstream call', async () => {
  let calls = 0
  const svc = new WeatherService(async () => {
    calls++
    await new Promise((r) => setTimeout(r, 20))
    return hourly
  })
  await Promise.all([svc.summary(13.75, 100.5), svc.summary(13.76, 100.51)])
  assert.equal(calls, 1)
})

test('an upstream outage falls back to the last good forecast', async () => {
  let fail = false
  const svc = new WeatherService(async () => {
    if (fail) throw new Error('open-meteo: status 503')
    return hourly
  })
  await svc.summary(13.75, 100.5)
  fail = true
  // ให้ cache หมดอายุ 30 นาที แต่ยังไม่เกิน 6 ชั่วโมง
  const realNow = Date.now
  Date.now = () => realNow() + 31 * 60 * 1000
  try {
    const s = await svc.summary(13.75, 100.5)
    assert.equal(s.today.uvMax, 9)
  } finally {
    Date.now = realNow
  }
})

test('an outage with nothing cached still fails', async () => {
  const svc = new WeatherService(async () => {
    throw new Error('open-meteo: status 503')
  })
  await assert.rejects(svc.summary(13.75, 100.5))
})
