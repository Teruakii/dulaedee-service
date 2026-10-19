import { Router, type Express, type Response } from 'express'
import { z } from 'zod'
import type { Client } from '../../infra/db/mongodb.js'
import { errorBoundary, ok, success, writeMapped, type ErrTable } from '../../infra/http/response.js'
import type { JWT } from '../../infra/jwt.js'
import type { Logger } from '../../infra/logs.js'
import { auth, currentUser } from '../../middleware/auth.js'
import type { DayLogService } from '../daylog/daylog.service.js'
import type { ProfileService } from '../profile/profile.service.js'
import type { WeatherService } from '../weather/weather.service.js'
import { PushRepo } from './push.repo.js'
import { ErrPushNotConfigured, PushService, type Vapid } from './push.service.js'

// server ส่ง POST ไปที่ endpoint นี้เอง ถ้ารับ URL อะไรก็ได้ จะถูกใช้ยิงเข้าเครื่องภายใน (SSRF) · รับเฉพาะ push service ของเบราว์เซอร์
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/]
export const isPushServiceURL = (raw: string) => {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((h) => h.test(u.hostname))
  } catch {
    return false
  }
}

const SubscribeRequest = z.object({
  endpoint: z.string().url().max(1000).refine(isPushServiceURL, 'UNSUPPORTED_PUSH_SERVICE'),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})
const UnsubscribeRequest = z.object({ endpoint: z.string().url().max(1000) })

const errTable: ErrTable = new Map([[ErrPushNotConfigured, 503]])
const h = errorBoundary((res: Response, err: unknown) => writeMapped(res, err, errTable))
const me = (res: Response) => currentUser(res).userID

export type PushDeps = { vapid: Vapid | null; logger: Logger; profiles: ProfileService; days: DayLogService; weather: WeatherService }

// module เล็ก handler อยู่ในไฟล์นี้
export class PushModule {
  private readonly repo: PushRepo
  private readonly svc: PushService

  constructor(db: Client, d: PushDeps) {
    this.repo = new PushRepo(db)
    this.svc = new PushService(this.repo, d.vapid, d.logger, d.profiles, d.days, d.weather)
  }

  ensureIndexes = () => this.repo.ensureIndexes()
  service = (): PushService => this.svc

  mount(app: Express, j: JWT) {
    const r = Router()
    r.get('/key', h(async (_req, res) => ok(res, { publicKey: this.svc.publicKey() })))
    r.post(
      '/subscriptions',
      auth(j),
      h(async (req, res) => {
        const b = SubscribeRequest.parse(req.body)
        await this.svc.subscribe(me(res), b.endpoint, b.keys)
        success(res, 'SUBSCRIBED')
      }),
    )
    r.delete(
      '/subscriptions',
      auth(j),
      h(async (req, res) => {
        await this.svc.unsubscribe(me(res), UnsubscribeRequest.parse(req.body).endpoint)
        success(res, 'UNSUBSCRIBED')
      }),
    )
    r.post(
      '/test',
      auth(j),
      h(async (_req, res) => ok(res, { delivered: await this.svc.send(me(res), { title: 'ดูแลดี', body: 'การแจ้งเตือนใช้ได้แล้ว', url: '/profile' }) })),
    )
    app.use('/push', r)
    this.svc.start()
  }
}
