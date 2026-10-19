import type { Notify } from '../profile/profile.model.js'

export type ReminderKind = 'water' | 'uv' | 'skin'
export type Reminder = { kind: ReminderKind; title: string; body: string; url: string }

// สถานะของวันนั้นที่ใช้ตัดสินว่าควรเตือนไหม · uvMax ไม่มีเมื่อดึงอากาศไม่ได้ (ข้ามการเตือน UV)
export type DayState = { waterMl: number; waterTargetMl: number; skinPmDone: number; uvMax?: number }

// เวลาเตือนตามเวลาไทย · เตือนน้ำทุก 2 ชม. ช่วงตื่น
const WATER_HOURS = [9, 11, 13, 15, 17, 19]
const UV_HOUR = 8
const SKIN_HOUR = 22
// UV 6 ขึ้นไป = สูง ตามเกณฑ์ WHO
export const UV_ALERT_MIN = 6
// scheduler อาจตื่นช้ากว่านาทีที่ 0 นิดหน่อย จึงนับ 5 นาทีแรกของชั่วโมง (กันส่งซ้ำด้วย key ที่ผู้เรียกเก็บ)
export const WINDOW_MIN = 5

const GLASS_ML = 250

export const isReminderMinute = (minute: number) => minute < WINDOW_MIN

/** ชั่วโมงนี้ควรมีการเตือนแบบไหนบ้าง (ยังไม่ดูข้อมูลผู้ใช้) */
export function kindsAt(hour: number): ReminderKind[] {
  return [...(WATER_HOURS.includes(hour) ? (['water'] as const) : []), ...(hour === UV_HOUR ? (['uv'] as const) : []), ...(hour === SKIN_HOUR ? (['skin'] as const) : [])]
}

export function dueReminders(hour: number, notify: Notify, s: DayState): Reminder[] {
  const out: Reminder[] = []
  for (const kind of kindsAt(hour)) {
    if (kind === 'water' && notify.water && s.waterMl < s.waterTargetMl) {
      const left = Math.ceil((s.waterTargetMl - s.waterMl) / GLASS_ML)
      out.push({ kind, title: 'ดื่มน้ำหน่อยไหม', body: `วันนี้ดื่มไป ${Math.floor(s.waterMl / GLASS_ML)} แก้ว ขาดอีก ${left} แก้ว`, url: '/today' })
    }
    if (kind === 'uv' && notify.uv && s.uvMax !== undefined && s.uvMax >= UV_ALERT_MIN) {
      out.push({ kind, title: `วันนี้ UV สูงถึง ${Math.round(s.uvMax)}`, body: 'ทากันแดดก่อนออกจากบ้าน และทาซ้ำทุก 2-3 ชั่วโมง', url: '/skin' })
    }
    if (kind === 'skin' && notify.skinRoutine && s.skinPmDone === 0) {
      out.push({ kind, title: 'ได้เวลา routine ก่อนนอน', body: 'ล้างหน้า บำรุง แล้วติ๊กในแอปได้เลย', url: '/skin' })
    }
  }
  return out
}
