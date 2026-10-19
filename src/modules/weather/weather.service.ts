import { fetchHourly, type HourlyForecast } from '../../infra/weather/openmeteo.js'
import { summarize, type WeatherSummary } from './advice.js'

const CACHE_TTL_MS = 30 * 60 * 1000
// Open-Meteo ล่มชั่วคราวได้ ใช้ค่าเดิมที่อายุไม่เกินนี้แทน
const STALE_OK_MS = 6 * 60 * 60 * 1000
const TIMEZONE = 'Asia/Bangkok'

// เวลาท้องถิ่นแบบ YYYY-MM-DDTHH:00 (sv-SE ให้รูปแบบ ISO)
const nowLocal = () => new Date().toLocaleString('sv-SE', { timeZone: TIMEZONE, hour12: false }).slice(0, 13).replace(' ', 'T') + ':00'

const MAX_AREAS = 500

// พยากรณ์รายชั่วโมงไม่เปลี่ยนบ่อย เก็บไว้ต่อพื้นที่ (~11 กม.) ครึ่งชั่วโมง
export class WeatherService {
  private readonly cache = new Map<string, { at: number; hourly: HourlyForecast }>()
  // หลายคำขอพร้อมกันของพื้นที่เดียวกันรอผลจากการเรียกครั้งเดียว
  private readonly inFlight = new Map<string, Promise<HourlyForecast>>()

  constructor(private readonly fetcher: typeof fetchHourly = fetchHourly) {}

  async summary(lat: number, lon: number): Promise<WeatherSummary> {
    return summarize(await this.hourly(Number(lat.toFixed(1)), Number(lon.toFixed(1))), nowLocal())
  }

  private async hourly(lat: number, lon: number): Promise<HourlyForecast> {
    const key = `${lat},${lon}`
    const hit = this.cache.get(key)
    if (hit && Date.now() - hit.at <= CACHE_TTL_MS) return hit.hourly

    let pending = this.inFlight.get(key)
    if (!pending) {
      pending = this.fetcher(lat, lon, TIMEZONE).finally(() => this.inFlight.delete(key))
      this.inFlight.set(key, pending)
    }
    try {
      const hourly = await pending
      // ลบก่อนใส่ใหม่ให้ key นี้ไปอยู่ท้าย Map แล้วตัดพื้นที่ที่เก่าสุดทิ้ง กันคนยิงพิกัดสุ่มจนหน่วยความจำเต็ม
      this.cache.delete(key)
      this.cache.set(key, { at: Date.now(), hourly })
      if (this.cache.size > MAX_AREAS) this.cache.delete(this.cache.keys().next().value!)
      return hourly
    } catch (err) {
      if (hit && Date.now() - hit.at <= STALE_OK_MS) return hit.hourly
      throw err
    }
  }
}
