import { ObjectId } from 'mongodb'
import webpush from 'web-push'
import { sentinel } from '../../constants/errors.js'
import type { Logger } from '../../infra/logs.js'
import type { DayLogService } from '../daylog/daylog.service.js'
import type { ProfileService } from '../profile/profile.service.js'
import type { WeatherService } from '../weather/weather.service.js'
import type { PushRepo } from './push.repo.js'
import { dueReminders, isReminderMinute, kindsAt, type Reminder } from './reminders.js'

export const ErrPushNotConfigured = sentinel('PUSH_NOT_CONFIGURED')

export type Vapid = { publicKey: string; privateKey: string; subject: string }
type Payload = { title: string; body: string; url: string }
// ตัวส่งจริงคือ web-push · test ใส่ตัวปลอมแทน เพราะ web-push ส่งได้เฉพาะ https
export type Sender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, body: string) => Promise<unknown>
const webpushSender: Sender = (sub, body) => webpush.sendNotification(sub, body, { TTL: 3600 })

// กรุงเทพฯ ใช้กับการเตือน UV · ผู้ใช้ยังไม่ได้เก็บพิกัด
const BKK = { lat: 13.75, lon: 100.5 }
const TICK_MS = 60_000

const bangkokNow = (now: Date) => {
  const local = new Date(now.getTime() + 7 * 3600_000)
  return { date: local.toISOString().slice(0, 10), hour: local.getUTCHours(), minute: local.getUTCMinutes() }
}

export class PushService {
  // กันส่งซ้ำในหน้าต่าง 5 นาที · ล้างเมื่อขึ้นวันใหม่
  private readonly sent = new Set<string>()
  private sentDate = ''
  private timer?: NodeJS.Timeout

  constructor(
    private readonly repo: PushRepo,
    private readonly vapid: Vapid | null,
    private readonly logger: Logger,
    private readonly profiles: ProfileService,
    private readonly days: DayLogService,
    private readonly weather: WeatherService,
    private readonly sender: Sender = webpushSender,
  ) {
    if (vapid) webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)
  }

  publicKey(): string {
    if (!this.vapid) throw ErrPushNotConfigured
    return this.vapid.publicKey
  }

  subscribe(userID: string, endpoint: string, keys: { p256dh: string; auth: string }) {
    return this.repo.upsert(new ObjectId(userID), endpoint, keys)
  }

  unsubscribe(userID: string, endpoint: string) {
    return this.repo.remove(new ObjectId(userID), endpoint)
  }

  /** ส่งให้ทุกเครื่องของผู้ใช้ · คืนจำนวนเครื่องที่ส่งถึง */
  async send(userID: string, p: Payload): Promise<number> {
    if (!this.vapid) throw ErrPushNotConfigured
    let delivered = 0
    for (const s of await this.repo.byUser(new ObjectId(userID))) {
      try {
        await this.sender({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(p))
        delivered++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410 = ผู้ใช้ยกเลิกหรือ subscription หมดอายุ
        if (status === 404 || status === 410) await this.repo.removeEndpoint(s.endpoint)
        else this.logger.error('ERROR_SENDING_PUSH', err)
      }
    }
    return delivered
  }

  start() {
    if (!this.vapid || this.timer) return
    this.timer = setInterval(() => void this.tick(new Date()).catch((err) => this.logger.error('ERROR_PUSH_TICK', err)), TICK_MS)
    this.timer.unref()
  }

  /** คืนจำนวนการเตือนที่ส่งถึงอย่างน้อยหนึ่งเครื่อง */
  async tick(now: Date): Promise<number> {
    const { date, hour, minute } = bangkokNow(now)
    if (!isReminderMinute(minute) || kindsAt(hour).length === 0) return 0
    if (date !== this.sentDate) {
      this.sent.clear()
      this.sentDate = date
    }
    const uvMax = kindsAt(hour).includes('uv')
      ? await this.weather.summary(BKK.lat, BKK.lon).then(
          (w) => w.today.uvMax,
          () => undefined,
        )
      : undefined

    let count = 0
    for (const uid of await this.repo.userIds()) {
      const userID = uid.toHexString()
      // ผู้ใช้ที่ยังไม่ตั้งโปรไฟล์ไม่มีการตั้งค่าเตือน ข้ามไป
      const reminders = await this.remindersFor(userID, date, hour, uvMax).catch((): Reminder[] => [])
      for (const r of reminders) {
        const key = `${userID}|${r.kind}|${hour}`
        if (this.sent.has(key)) continue
        this.sent.add(key)
        if ((await this.send(userID, r)) > 0) count++
      }
    }
    return count
  }

  private async remindersFor(userID: string, date: string, hour: number, uvMax?: number): Promise<Reminder[]> {
    const [{ profile }, day] = await Promise.all([this.profiles.me(userID), this.days.day(userID, date)])
    return dueReminders(hour, profile.notify, {
      waterMl: day.waterMl,
      waterTargetMl: day.targets?.waterMl ?? 0,
      skinPmDone: day.skinDone.pm.length,
      ...(uvMax !== undefined ? { uvMax } : {}),
    })
  }
}
