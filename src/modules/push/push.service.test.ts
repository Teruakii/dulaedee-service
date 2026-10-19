import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ObjectId } from 'mongodb'
import webpush from 'web-push'
import { Logger } from '../../infra/logs.js'
import type { DayLogService } from '../daylog/daylog.service.js'
import type { ProfileService } from '../profile/profile.service.js'
import type { WeatherService } from '../weather/weather.service.js'
import type { PushSub } from './push.model.js'
import type { PushRepo } from './push.repo.js'
import { PushService } from './push.service.js'

// push service ปลอม: /ok รับแล้ว · /gone ตอบ 410 เหมือนผู้ใช้ยกเลิก
const base = 'https://push.example'
const hits: { endpoint: string; body: { title: string } }[] = []
const sender = async (sub: { endpoint: string }, body: string) => {
  hits.push({ endpoint: sub.endpoint.slice(base.length), body: JSON.parse(body) })
  if (sub.endpoint.endsWith('/gone')) throw Object.assign(new Error('gone'), { statusCode: 410 })
}

const user = new ObjectId()
const browserKeys = () => ({ p256dh: 'p256dh', auth: 'auth' })

function setup(water = 500) {
  const subs: PushSub[] = [
    { _id: new ObjectId(), userId: user, endpoint: `${base}/ok`, keys: browserKeys(), createdAt: new Date() },
    { _id: new ObjectId(), userId: user, endpoint: `${base}/gone`, keys: browserKeys(), createdAt: new Date() },
  ]
  const repo = {
    byUser: async () => subs.filter((s) => s.userId.equals(user)),
    userIds: async () => [user],
    removeEndpoint: async (e: string) => void subs.splice(subs.findIndex((s) => s.endpoint === e), 1),
  } as unknown as PushRepo
  const profiles = { me: async () => ({ profile: { notify: { water: true, uv: true, skinRoutine: true, clips: true } } }) } as unknown as ProfileService
  const days = { day: async () => ({ waterMl: water, targets: { waterMl: 1900 }, skinDone: { am: [], pm: [] } }) } as unknown as DayLogService
  const weather = { summary: async () => ({ today: { uvMax: 9.2 } }) } as unknown as WeatherService
  const vapid = { ...webpush.generateVAPIDKeys(), subject: 'mailto:test@localhost' }
  return { subs, svc: new PushService(repo, vapid, new Logger(), profiles, days, weather, sender) }
}

// เวลาไทย = UTC + 7
const bkk = (h: number, m: number) => new Date(Date.UTC(2026, 9, 14, h - 7, m))

test('8:02 sends the UV alert once, and drops the subscription the push service says is gone', async () => {
  const { subs, svc } = setup()
  hits.length = 0
  assert.equal(await svc.tick(bkk(8, 2)), 1)
  assert.deepEqual(hits.map((h) => h.endpoint).sort(), ['/gone', '/ok'])
  assert.equal(hits[0]!.body.title, 'วันนี้ UV สูงถึง 9')
  assert.deepEqual(subs.map((s) => s.endpoint), [`${base}/ok`])
  assert.equal(await svc.tick(bkk(8, 3)), 0, 'not sent twice in the same window')
})

test('water at 11:00 only while short, nothing at 10:00 or past the 5-minute window', async () => {
  assert.equal(await setup().svc.tick(bkk(10, 0)), 0)
  assert.equal(await setup().svc.tick(bkk(11, 6)), 0)
  assert.equal(await setup().svc.tick(bkk(11, 0)), 1)
  assert.equal(await setup(2000).svc.tick(bkk(11, 0)), 0)
})
