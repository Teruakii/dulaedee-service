import type { HourlyForecast } from '../../infra/weather/openmeteo.js'

// ระดับ UV ตาม WHO: ค่าต่ำสุดของแต่ละระดับ
export const UV_LEVELS = [
  [0, 'low'],
  [3, 'moderate'],
  [6, 'high'],
  [8, 'very_high'],
  [11, 'extreme'],
] as const
export type UvLevel = (typeof UV_LEVELS)[number][1]

export const uvLevelOf = (uv: number): UvLevel => [...UV_LEVELS].reverse().find(([min]) => uv >= min)![1]

// คำแนะนำเป็น code ให้ frontend แปลเป็นข้อความ · เงื่อนไขอยู่ในตารางเดียว
type Ctx = { uvMax: number; humidityPct: number }
export const ADVICE: readonly [string, (c: Ctx) => boolean][] = [
  ['SUNSCREEN_SPF50', (c) => c.uvMax >= 6],
  ['REAPPLY_SUNSCREEN_2H', (c) => c.uvMax >= 8],
  ['AVOID_SUN_10_TO_16', (c) => c.uvMax >= 11],
  ['DRINK_MORE_WATER', (c) => c.uvMax >= 8 || c.humidityPct >= 80],
  ['GEL_MOISTURIZER', (c) => c.humidityPct >= 75],
  ['RICH_MOISTURIZER', (c) => c.humidityPct < 45],
]

export type WeatherSummary = {
  now: { time: string; uvIndex: number; humidityPct: number }
  today: { date: string; uvMax: number; uvMaxTime: string; uvLevel: UvLevel }
  tomorrow: { date: string; uvMax: number; uvLevel: UvLevel } | null
  advice: string[]
}

function dayMax(h: HourlyForecast, date: string): { uvMax: number; time: string } | null {
  let best: { uvMax: number; time: string } | null = null
  h.time.forEach((t, i) => {
    const uv = h.uv_index[i]
    if (t.startsWith(date) && uv != null && (!best || uv > best.uvMax)) best = { uvMax: uv, time: t }
  })
  return best
}

// nowLocal = เวลาท้องถิ่นแบบ YYYY-MM-DDTHH:00 ตรงกับรูปแบบของ Open-Meteo
export function summarize(h: HourlyForecast, nowLocal: string): WeatherSummary {
  const date = nowLocal.slice(0, 10)
  const i = Math.max(0, h.time.indexOf(nowLocal))
  const today = dayMax(h, date) ?? { uvMax: 0, time: nowLocal }
  const tomorrowDate = h.time.find((t) => t.slice(0, 10) > date)?.slice(0, 10)
  const tomorrow = tomorrowDate ? dayMax(h, tomorrowDate) : null
  const humidityPct = h.relative_humidity_2m[i] ?? 0
  return {
    now: { time: h.time[i] ?? nowLocal, uvIndex: h.uv_index[i] ?? 0, humidityPct },
    today: { date, uvMax: today.uvMax, uvMaxTime: today.time, uvLevel: uvLevelOf(today.uvMax) },
    tomorrow: tomorrow && tomorrowDate ? { date: tomorrowDate, uvMax: tomorrow.uvMax, uvLevel: uvLevelOf(tomorrow.uvMax) } : null,
    advice: ADVICE.filter(([, when]) => when({ uvMax: today.uvMax, humidityPct })).map(([code]) => code),
  }
}
