const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

export type HourlyForecast = { time: string[]; uv_index: (number | null)[]; relative_humidity_2m: (number | null)[] }

// Open-Meteo ใช้ฟรีไม่ต้องมี key · เวลาใน hourly เป็นเวลาท้องถิ่นตาม timezone ที่ขอ
export async function fetchHourly(lat: number, lon: number, timezone = 'Asia/Bangkok'): Promise<HourlyForecast> {
  const q = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    hourly: 'uv_index,relative_humidity_2m',
    timezone,
    forecast_days: '2',
  })
  const res = await fetch(`${FORECAST_URL}?${q}`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`open-meteo: status ${res.status}`)
  const body = (await res.json()) as { hourly: HourlyForecast }
  return body.hourly
}
