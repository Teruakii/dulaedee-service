// รัน server จริงกับ MongoDB จริง (in-memory) แล้วเดิน flow หลักของแอปผ่าน HTTP
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { MongoMemoryServer } from 'mongodb-memory-server'
import webpush from 'web-push'

const PORT = 3199
const BASE = `http://127.0.0.1:${PORT}`
const ADMIN_PASSWORD = 'smoke-admin-pass'

type Res = { status: number; body: any; headers: Headers }

async function call(method: string, path: string, opts: { token?: string; body?: unknown; cookie?: string } = {}): Promise<Res> {
  const headers: Record<string, string> = {}
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`
  if (opts.cookie) headers['Cookie'] = opts.cookie
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual',
  })
  const type = res.headers.get('content-type') ?? ''
  const body = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer())
  return { status: res.status, body, headers: res.headers }
}

let passed = 0
async function check(name: string, fn: () => Promise<void>) {
  await fn()
  passed++
  console.log(`ok  ${name}`)
}

const mongo = await MongoMemoryServer.create()
const vapid = webpush.generateVAPIDKeys()
const server = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    APP_ENV: 'development',
    JWT_SECRET_KEY: 'smoke-secret',
    MONGO_URI: mongo.getUri(),
    MONGO_DB: 'dulaedee_smoke',
    SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
    // ค่าปลอม: พอให้ /auth/google ออก state ได้ ไม่ได้คุยกับ Google จริง · ไม่ใช้ค่าจาก .env ของเครื่อง
    GOOGLE_OAUTH_CLIENT_ID: 'smoke-client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'smoke-secret',
    GOOGLE_OAUTH_REDIRECT_URL: `${BASE}/auth/google/callback`,
    CLIENT_URL: 'http://app.smoke',
    SMTP_URL: '',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
})
let serverLog = ''
server.stdout!.on('data', (d) => (serverLog += d))

try {
  for (let i = 0; ; i++) {
    const up = await fetch(BASE + '/').then((r) => r.ok, () => false)
    if (up) break
    if (i > 60) throw new Error('server did not start\n' + serverLog)
    await new Promise((r) => setTimeout(r, 500))
  }

  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  let member = ''
  let refreshCookie = ''

  await check('register a member, then /auth/me with the access token', async () => {
    const reg = await call('POST', '/auth/register', {
      body: { username: 'mind', password: 'password1', email: 'Mind@Example.com', firstName: 'มายด์', acceptTerms: true, acceptPrivacy: true },
    })
    assert.equal(reg.status, 201, JSON.stringify(reg.body))
    member = reg.body.data.accessToken
    const me = await call('GET', '/auth/me', { token: member })
    assert.equal(me.body.data.user.role, 'MEMBER')
    assert.equal(me.body.data.user.email, 'mind@example.com')
  })

  await check('login by email sets an httpOnly refresh cookie; /auth/me with only the cookie issues a new access token', async () => {
    const login = await call('POST', '/auth/login', { body: { username: 'mind@example.com', password: 'password1' } })
    assert.equal(login.status, 200)
    const setCookie = login.headers.get('set-cookie') ?? ''
    assert.match(setCookie, /refresh_token=.+HttpOnly/i)
    refreshCookie = setCookie.split(';')[0]!
    const me = await call('GET', '/auth/me', { cookie: refreshCookie })
    assert.equal(me.status, 200)
    assert.ok(me.body.data.accessToken)
    const bad = await call('POST', '/auth/login', { body: { username: 'mind', password: 'wrong-pass' } })
    assert.equal(bad.status, 401)
    assert.equal(bad.body.message, 'INVALID_CREDENTIALS')
  })

  await check('validation errors come back as 400 with field payload', async () => {
    const res = await call('POST', '/auth/register', { body: { username: 'x', password: '1', email: 'no', firstName: '', acceptTerms: false } })
    assert.equal(res.status, 400)
    assert.equal(res.body.message, 'INVALID_REQUEST')
    const fields = res.body.payload.map((p: { field: string }) => p.field)
    for (const f of ['username', 'password', 'email', 'acceptTerms']) assert.ok(fields.includes(f), `missing ${f} in ${fields}`)
  })

  await check('a day with no profile yet has null targets', async () => {
    const day = await call('GET', `/daylogs/${today}`, { token: member })
    assert.equal(day.status, 200)
    assert.equal(day.body.data.targets, null)
    assert.equal(day.body.data.totals.kcal, 0)
  })

  await check('onboarding profile gives the mockup budget of 1,450 kcal', async () => {
    const res = await call('PUT', '/profile/me', {
      token: member,
      body: { sex: 'female', birthYear: new Date().getFullYear() - 28, heightCm: 160, weightKg: 58, activity: 'light', goal: 'lose', skinType: 'combination', skinConcerns: ['acne'] },
    })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.targets.kcal, 1450)
    assert.equal(res.body.data.profile.age, 28)
    assert.deepEqual(res.body.data.profile.notify, { water: true, uv: true, skinRoutine: false })
  })

  const foods: Record<string, string> = {}
  await check('seeded Thai menu is searchable by a Thai substring', async () => {
    const res = await call('GET', `/foods?q=${encodeURIComponent('กะเพรา')}`, { token: member })
    assert.equal(res.status, 200)
    assert.ok(res.body.data.length >= 3)
    assert.deepEqual(Object.keys(res.body.pagination), ['page', 'limit', 'hasMore'])
    const all = await call('GET', '/foods?limit=100', { token: member })
    for (const f of all.body.data) foods[f.nameTh] = f.id
    assert.ok(foods['ข้าวมันไก่'] && foods['โจ๊กหมูใส่ไข่'])
  })

  await check('log breakfast and lunch from the menu: 846 eaten, 604 left', async () => {
    await call('POST', `/daylogs/${today}/entries`, { token: member, body: { meal: 'breakfast', foodId: foods['โจ๊กหมูใส่ไข่'] } })
    const res = await call('POST', `/daylogs/${today}/entries`, { token: member, body: { meal: 'lunch', foodId: foods['ข้าวมันไก่'] } })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.totals.kcal, 846)
    assert.equal(res.body.data.remaining.kcal, 604)
    assert.equal(res.body.data.byMeal.lunch.kcal, 596)
  })

  await check('a custom entry for a dish not in the menu, then delete it', async () => {
    const add = await call('POST', `/daylogs/${today}/entries`, { token: member, body: { meal: 'snack', nameTh: 'ข้าวซอยไก่ใส่ไข่', kcal: 615 } })
    const entry = add.body.data.entries.find((e: { nameTh: string }) => e.nameTh === 'ข้าวซอยไก่ใส่ไข่')
    assert.equal(add.body.data.totals.kcal, 846 + 615)
    const del = await call('DELETE', `/daylogs/${today}/entries/${entry.id}`, { token: member })
    assert.equal(del.body.data.totals.kcal, 846)
    const again = await call('DELETE', `/daylogs/${today}/entries/${entry.id}`, { token: member })
    assert.equal(again.status, 404)
  })

  await check('a member saves their own menu, only they see and delete it, and the shared menu stays untouched', async () => {
    const add = await call('POST', '/foods/mine', { token: member, body: { nameTh: 'ข้าวซอยบ้านยาย', kcal: 615, proteinG: 25, carbG: 60, fatG: 30 } })
    assert.equal(add.status, 201, JSON.stringify(add.body))
    const mine = add.body.data
    assert.equal(mine.personal, true)
    assert.equal(mine.unit, 'serving')
    assert.equal(mine.verified, false)

    const listed = await call('GET', `/foods?q=${encodeURIComponent('ข้าวซอยบ้านยาย')}`, { token: member })
    assert.deepEqual(listed.body.data.map((f: { id: string }) => f.id), [mine.id])
    const firstPage = await call('GET', '/foods?limit=8', { token: member })
    assert.equal(firstPage.body.data[0].id, mine.id, 'own menus come first in the full list')
    const onlyMine = await call('GET', '/foods?mine=true', { token: member })
    assert.deepEqual(onlyMine.body.data.map((f: { id: string }) => f.id), [mine.id])
    const shared = await call('GET', `/foods?q=${encodeURIComponent('ข้าวมันไก่')}`, { token: member })
    assert.equal(shared.body.data[0].personal, false)

    const admin = (await call('POST', '/auth/login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.data.accessToken
    const adminSees = await call('GET', `/foods?q=${encodeURIComponent('ข้าวซอยบ้านยาย')}`, { token: admin })
    assert.equal(adminSees.body.data.length, 0)
    assert.equal((await call('GET', `/foods/${mine.id}`, { token: admin })).status, 404)
    assert.equal((await call('DELETE', `/foods/mine/${mine.id}`, { token: admin })).status, 404)
    assert.equal((await call('DELETE', `/foods/mine/${foods['ข้าวมันไก่']}`, { token: member })).status, 404)

    const logged = await call('POST', `/daylogs/${today}/entries`, { token: member, body: { meal: 'snack', foodId: mine.id } })
    assert.equal(logged.body.data.totals.kcal, 846 + 615)
    const entry = logged.body.data.entries.find((e: { nameTh: string }) => e.nameTh === 'ข้าวซอยบ้านยาย')

    assert.equal((await call('DELETE', `/foods/mine/${mine.id}`, { token: member })).status, 200)
    assert.equal((await call('GET', '/foods?mine=true', { token: member })).body.data.length, 0)
    const after = await call('POST', `/daylogs/${today}/entries`, { token: member, body: { meal: 'snack', foodId: mine.id } })
    assert.equal(after.status, 404)
    const kept = await call('DELETE', `/daylogs/${today}/entries/${entry.id}`, { token: member })
    assert.equal(kept.body.data.totals.kcal, 846)
  })

  let recommended: { id: string; nameTh: string }[] = []
  await check('recommend dinners that fit 604 kcal, protein-dense first', async () => {
    const res = await call('GET', '/foods/recommend?remainingKcal=604&proteinGapG=59&limit=3', { token: member })
    recommended = res.body.data
    assert.equal(recommended.length, 3)
    for (const f of res.body.data) assert.ok(f.kcal <= 604 && f.kcal >= 151, `${f.nameTh} ${f.kcal}`)
    console.log('    ', recommended.map((f) => f.nameTh).join(' | '))
  })

  await check('water adds up and never goes below zero', async () => {
    await call('POST', `/daylogs/${today}/water`, { token: member, body: { deltaMl: 250 } })
    const two = await call('POST', `/daylogs/${today}/water`, { token: member, body: { deltaMl: 250 } })
    assert.equal(two.body.data.waterMl, 500)
    const neg = await call('POST', `/daylogs/${today}/water`, { token: member, body: { deltaMl: -1000 } })
    assert.equal(neg.body.data.waterMl, 0)
  })

  await check("today's weight updates the profile, and the budget follows", async () => {
    await call('PUT', `/daylogs/${today}/weight`, { token: member, body: { weightKg: 57 } })
    const prof = await call('GET', '/profile/me', { token: member })
    assert.equal(prof.body.data.profile.weightKg, 57)
    const range = await call('GET', `/daylogs?from=${today}&to=${today}`, { token: member })
    assert.equal(range.body.data[0].weightKg, 57)
    assert.equal(range.body.data[0].kcal, 846)
  })

  let serumId = ''
  await check('night routine flags the AHA + retinol clash; retinol in the morning is warned', async () => {
    const mk = (body: object) => call('POST', '/skin/products', { token: member, body })
    await mk({ name: 'คลีนซิ่งโฟม', step: 'cleanser', slots: ['am', 'pm'] })
    const toner = await mk({ name: 'โทนเนอร์ AHA 5%', step: 'toner', actives: ['aha'], slots: ['pm'] })
    const serum = await mk({ name: 'เซรั่มเรตินอล 0.3%', step: 'serum', actives: ['retinol'], slots: ['am', 'pm'] })
    serumId = serum.body.data.id
    const pm = await call('GET', '/skin/routine/pm', { token: member })
    assert.deepEqual(
      pm.body.data.products.map((p: { name: string }) => p.name),
      ['คลีนซิ่งโฟม', 'โทนเนอร์ AHA 5%', 'เซรั่มเรตินอล 0.3%'],
    )
    assert.deepEqual(pm.body.data.clashes, [{ productIds: [toner.body.data.id, serumId], actives: ['aha', 'retinol'], kind: 'IRRITATION' }])
    const am = await call('GET', '/skin/routine/am', { token: member })
    assert.equal(am.body.data.warnings[0].code, 'RETINOL_AT_NIGHT')
    const done = await call('PUT', `/daylogs/${today}/skin/pm`, { token: member, body: { done: [serumId, serumId] } })
    assert.deepEqual(done.body.data.skinDone.pm, [serumId])
  })

  await check("another member cannot touch someone else's product", async () => {
    const reg = await call('POST', '/auth/register', {
      body: { username: 'other', password: 'password1', email: 'other@example.com', firstName: 'อื่น', acceptTerms: true, acceptPrivacy: true },
    })
    const other = reg.body.data.accessToken
    const del = await call('DELETE', `/skin/products/${serumId}`, { token: other })
    assert.equal(del.status, 404)
    const mine = await call('GET', '/skin/products', { token: member })
    assert.ok(mine.body.data.some((p: { id: string }) => p.id === serumId))
  })

  await check('20 real seeded clips are linked to their dishes, and a dish gets its own clip', async () => {
    const all = await call('GET', '/clips?limit=50', { token: member })
    assert.equal(all.body.data.length, 20)
    assert.ok(all.body.data.every((c: { foodIds: string[] }) => c.foodIds.length > 0), 'every seeded clip found its dish')
    const foods = (await call('GET', '/foods?q=ข้าวมันไก่', { token: member })).body.data as { id: string }[]
    const rec = await call('GET', `/clips/recommend?foodIds=${foods[0]!.id}`, { token: member })
    assert.equal(rec.body.data[0].youtubeId, 'aROCPCKzbR0')
  })

  await check('members cannot edit the menu; staff-level admin can curate a clip that members then get for the recommended dish', async () => {
    const denied = await call('POST', '/foods', { token: member, body: { nameTh: 'x', unit: 'plate', kcal: 1, proteinG: 0, carbG: 0, fatG: 0 } })
    assert.equal(denied.status, 403)
    const admin = (await call('POST', '/auth/login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.data.accessToken
    const top = recommended[0]!
    const clip = await call('POST', '/clips', {
      token: admin,
      body: { youtubeId: 'https://www.youtube.com/watch?v=aBcDeFgHiJk', title: `วิธีทำ ${top.nameTh}`, channel: 'ทดสอบ', durationSec: 504, foodIds: [top.id] },
    })
    assert.equal(clip.status, 201, JSON.stringify(clip.body))
    assert.equal(clip.body.data.youtubeId, 'aBcDeFgHiJk')
    const rec = await call('GET', `/clips/recommend?foodIds=${recommended.map((f) => f.id).join(',')}`, { token: member })
    const mine = rec.body.data.find((c: { youtubeId: string }) => c.youtubeId === 'aBcDeFgHiJk')
    assert.equal(mine.title, `วิธีทำ ${top.nameTh}`)
    assert.equal(mine.thumbnailUrl, 'https://i.ytimg.com/vi/aBcDeFgHiJk/hqdefault.jpg')
  })

  await check('workout plan: typed by the user, logged from the plan, burned kcal shown but not added to the budget', async () => {
    const empty = await call('GET', '/workouts/plan', { token: member })
    assert.deepEqual(empty.body.data.days, [[], [], [], [], [], [], []])

    const set = await call('PUT', '/workouts/plan/days/0', { token: member, body: { items: [{ name: '  เดินเร็วรอบหมู่บ้าน ', minutes: 30, kcal: 120 }, { name: 'โยคะ', minutes: 20 }] } })
    assert.equal(set.status, 200, JSON.stringify(set.body))
    const [walk, yoga] = set.body.data.days[0] as { id: string; name: string; minutes: number; kcal?: number }[]
    assert.equal(walk!.name, 'เดินเร็วรอบหมู่บ้าน')
    assert.equal(yoga!.kcal, undefined)
    assert.deepEqual(set.body.data.days[1], [])

    const before = (await call('GET', `/daylogs/${today}`, { token: member })).body.data.remaining.kcal
    await call('POST', `/daylogs/${today}/workouts`, { token: member, body: { planItemId: walk!.id, name: walk!.name, minutes: walk!.minutes, kcal: walk!.kcal } })
    const logged = await call('POST', `/daylogs/${today}/workouts`, { token: member, body: { planItemId: yoga!.id, name: yoga!.name, minutes: yoga!.minutes } })
    assert.equal(logged.status, 200, JSON.stringify(logged.body))
    // ไม่ได้ใส่ kcal ก็นับแค่เวลา
    assert.deepEqual(logged.body.data.burned, { kcal: 120, minutes: 50 })
    assert.equal(logged.body.data.workouts[0].planItemId, walk!.id)
    assert.equal(logged.body.data.remaining.kcal, before)
    const range = await call('GET', `/daylogs?from=${today}&to=${today}`, { token: member })
    assert.equal(range.body.data[0].burnedKcal, 120)

    const del = await call('DELETE', `/daylogs/${today}/workouts/${logged.body.data.workouts[0].id}`, { token: member })
    assert.deepEqual(del.body.data.burned, { kcal: 0, minutes: 20 })

    const blank = await call('PUT', '/workouts/plan/days/6', { token: member, body: { items: [{ name: '   ', minutes: 10 }] } })
    assert.equal(blank.status, 400)
  })

  await check('public calorie calculator needs no login', async () => {
    const res = await call('POST', '/profile/calc', { body: { sex: 'female', age: 28, heightCm: 160, weightKg: 58, activity: 'light', goal: 'lose' } })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.bmr, 1279)
  })

  await check('weather: live UV and humidity for Bangkok, or 503 when Open-Meteo is unreachable', async () => {
    const res = await call('GET', '/weather', { token: member })
    assert.ok(res.status === 200 || res.status === 503)
    if (res.status === 200) {
      assert.equal(typeof res.body.data.today.uvMax, 'number')
      console.log(`     UV max today ${res.body.data.today.uvMax} (${res.body.data.today.uvLevel}), humidity now ${res.body.data.now.humidityPct}%, advice ${res.body.data.advice.join(',')}`)
    } else console.log('     weather unavailable (503)')
  })

  await check('no token is 401 on protected routes', async () => {
    assert.equal((await call('GET', `/daylogs/${today}`)).status, 401)
    assert.equal((await call('GET', '/users', { token: member })).status, 403)
  })

  await check('delete my account: data and login are gone, other members untouched', async () => {
    const reg = await call('POST', '/auth/register', {
      body: { username: 'leaver', password: 'password1', email: 'leaver@example.com', firstName: 'ลา', acceptTerms: true, acceptPrivacy: true },
    })
    const t = reg.body.data.accessToken
    await call('PUT', '/profile/me', { token: t, body: { sex: 'male', birthYear: 1995, heightCm: 175, weightKg: 70, activity: 'light', goal: 'maintain' } })
    await call('PUT', '/workouts/plan/days/0', { token: t, body: { items: [{ name: 'วิ่ง', minutes: 20 }] } })

    assert.equal((await call('DELETE', '/account', { token: t, body: { confirm: 'delete' } })).status, 400)
    const del = await call('DELETE', '/account', { token: t, body: { confirm: 'ลบบัญชี' } })
    assert.equal(del.status, 200, JSON.stringify(del.body))
    assert.equal((await call('POST', '/auth/login', { body: { username: 'leaver', password: 'password1' } })).status, 401)
    assert.equal((await call('GET', '/profile/me', { token: t })).status, 404)
    assert.equal((await call('GET', '/workouts/plan', { token: t })).body.data.days[0].length, 0)
    // คนอื่นยังอยู่ครบ
    assert.equal((await call('GET', '/profile/me', { token: member })).status, 200)
  })

  await check('web push: public key is open, a browser subscription is stored for the member and can be removed', async () => {
    const key = await call('GET', '/push/key')
    assert.equal(key.body.data.publicKey, vapid.publicKey)
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/smoke-device', keys: { p256dh: 'BOr-smoke', auth: 'smoke-auth' } }
    assert.equal((await call('POST', '/push/subscriptions', { body: sub })).status, 401)
    assert.equal((await call('POST', '/push/subscriptions', { token: member, body: sub })).status, 200)
    assert.equal((await call('POST', '/push/subscriptions', { token: member, body: { endpoint: 'not a url', keys: sub.keys } })).status, 400)
    assert.equal((await call('DELETE', '/push/subscriptions', { token: member, body: { endpoint: sub.endpoint } })).status, 200)
  })

  await check('forgot password: same answer for unknown email, link (logged without SMTP) resets once, then dies', async () => {
    await call('POST', '/auth/register', {
      body: { username: 'forgetful', password: 'password1', email: 'forget@example.com', firstName: 'ลืม', acceptTerms: true, acceptPrivacy: true },
    })
    const unknown = await call('POST', '/auth/forgot-password', { body: { email: 'nobody@example.com' } })
    const known = await call('POST', '/auth/forgot-password', { body: { email: 'Forget@Example.com' } })
    assert.equal(unknown.status, 200)
    assert.deepEqual(known.body, unknown.body)
    await new Promise((r) => setTimeout(r, 300))
    const token = [...serverLog.matchAll(/reset-password\?token=([A-Za-z0-9._-]+)/g)].at(-1)?.[1]
    assert.ok(token, 'reset link was logged')

    assert.equal((await call('POST', '/auth/reset-password', { body: { token, newPassword: 'short' } })).status, 400)
    const reset = await call('POST', '/auth/reset-password', { body: { token, newPassword: 'newpassword2' } })
    assert.equal(reset.status, 200, JSON.stringify(reset.body))
    assert.equal((await call('POST', '/auth/login', { body: { username: 'forgetful', password: 'password1' } })).status, 401)
    assert.equal((await call('POST', '/auth/login', { body: { username: 'forgetful', password: 'newpassword2' } })).status, 200)
    const again = await call('POST', '/auth/reset-password', { body: { token, newPassword: 'newpassword3' } })
    assert.equal(again.status, 400)
    assert.equal(again.body.message, 'RESET_TOKEN_INVALID')
  })

  const cookieOf = (r: Res) => (r.headers.get('set-cookie') ?? '').split(';')[0]!

  await check('changing the password logs out other devices but keeps this one', async () => {
    const reg = await call('POST', '/auth/register', {
      body: { username: 'mover', password: 'password1', email: 'mover@example.com', firstName: 'ย้าย', acceptTerms: true, acceptPrivacy: true },
    })
    const phone = cookieOf(reg)
    const laptop = cookieOf(await call('POST', '/auth/login', { body: { username: 'mover', password: 'password1' } }))
    assert.equal((await call('GET', '/auth/me', { cookie: laptop })).status, 200)

    const change = await call('POST', '/auth/change-password', { token: reg.body.data.accessToken, body: { currentPassword: 'password1', newPassword: 'password2' } })
    assert.equal(change.status, 200, JSON.stringify(change.body))
    assert.ok(change.body.data.accessToken)
    assert.equal((await call('GET', '/auth/me', { cookie: laptop })).body.message, 'SESSION_INVALID')
    assert.equal((await call('GET', '/auth/me', { cookie: phone })).status, 401)
    assert.equal((await call('GET', '/auth/me', { cookie: cookieOf(change) })).status, 200)
  })

  await check('an admin deleting a member also deletes their health data and own menus', async () => {
    const reg = await call('POST', '/auth/register', {
      body: { username: 'removed', password: 'password1', email: 'removed@example.com', firstName: 'ลบ', acceptTerms: true, acceptPrivacy: true },
    })
    const t = reg.body.data.accessToken
    const id = (await call('GET', '/auth/me', { token: t })).body.data.user.id
    await call('PUT', '/profile/me', { token: t, body: { sex: 'male', birthYear: 1995, heightCm: 175, weightKg: 70, activity: 'light', goal: 'maintain' } })
    const food = (await call('POST', '/foods/mine', { token: t, body: { nameTh: 'เมนูลับ', kcal: 100, proteinG: 1, carbG: 1, fatG: 1 } })).body.data
    assert.deepEqual((await call('GET', '/foods?mine=true', { token: t })).body.data.map((f: { id: string }) => f.id), [food.id])

    const admin = (await call('POST', '/auth/login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.data.accessToken
    assert.equal((await call('DELETE', `/users/${id}`, { token: admin })).status, 200)
    assert.equal((await call('DELETE', `/users/${id}`, { token: admin })).status, 404)
    assert.equal((await call('DELETE', '/users/not-an-id', { token: admin })).status, 404)
    assert.equal((await call('GET', '/profile/me', { token: t })).status, 404)
    assert.equal((await call('GET', '/foods?mine=true', { token: t })).body.data.length, 0)
  })

  await check('push subscriptions only accept real browser push services, so the server cannot be aimed at internal hosts', async () => {
    const keys = { p256dh: 'BOr-smoke', auth: 'smoke-auth' }
    for (const endpoint of ['http://127.0.0.1:27017/', 'https://169.254.169.254/latest/meta-data', 'https://fcm.googleapis.com.evil.example/x', 'http://fcm.googleapis.com/fcm/send/x', 'https://fcm.googleapis.com:8443/x']) {
      const res = await call('POST', '/push/subscriptions', { token: member, body: { endpoint, keys } })
      assert.equal(res.status, 400, endpoint)
    }
    for (const endpoint of ['https://fcm.googleapis.com/fcm/send/a', 'https://web.push.apple.com/b', 'https://updates.push.services.mozilla.com/wpush/v2/c', 'https://wns2-par02p.notify.windows.com/w/?token=d']) {
      assert.equal((await call('POST', '/push/subscriptions', { token: member, body: { endpoint, keys } })).status, 200, endpoint)
      await call('DELETE', '/push/subscriptions', { token: member, body: { endpoint } })
    }
  })

  await check('signup emails a verify link (logged without SMTP) that marks the email verified; a forged link is refused', async () => {
    const reg = await call('POST', '/auth/register', {
      body: { username: 'verifier', password: 'password1', email: 'verify@example.com', firstName: 'ยืนยัน', acceptTerms: true, acceptPrivacy: true },
    })
    const t = reg.body.data.accessToken
    assert.equal((await call('GET', '/auth/me', { token: t })).body.data.user.emailVerified, false)
    await new Promise((r) => setTimeout(r, 300))
    const token = [...serverLog.matchAll(/verify-email\?token=([A-Za-z0-9._-]+)/g)].at(-1)?.[1]
    assert.ok(token, 'verify link was logged')
    const forged = await call('POST', '/auth/verify-email', { body: { token: token.slice(0, -3) + 'abc' } })
    assert.equal(forged.status, 400)
    assert.equal(forged.body.message, 'VERIFY_EMAIL_TOKEN_INVALID')
    assert.equal((await call('POST', '/auth/verify-email', { body: { token } })).status, 200)
    assert.equal((await call('GET', '/auth/me', { token: t })).body.data.user.emailVerified, true)
  })

  await check('usernames ignore case: Casey and casey are one account, and login works in any case', async () => {
    const reg = await call('POST', '/auth/register', {
      body: { username: 'Casey', password: 'password1', email: 'casey@example.com', firstName: 'เคซี่', acceptTerms: true, acceptPrivacy: true },
    })
    assert.equal(reg.status, 201, JSON.stringify(reg.body))
    assert.equal((await call('GET', '/auth/me', { token: reg.body.data.accessToken })).body.data.user.username, 'casey')
    const dup = await call('POST', '/auth/register', {
      body: { username: 'casey', password: 'password1', email: 'casey2@example.com', firstName: 'ซ้ำ', acceptTerms: true, acceptPrivacy: true },
    })
    assert.equal(dup.body.message, 'USERNAME_ALREADY_EXISTS')
    assert.equal((await call('POST', '/auth/login', { body: { username: 'CASEY', password: 'password1' } })).status, 200)
  })

  await check('a forged OAuth state with Thai letters goes to the failed page instead of a 500', async () => {
    const start = await call('GET', '/auth/google')
    assert.equal(start.status, 200)
    const cookie = cookieOf(start)
    const state = cookie.split('=')[1]!
    const forged = state.slice(1) + 'ก'
    const res = await call('GET', `/auth/google/callback?code=x&state=${encodeURIComponent(forged)}`, { cookie })
    assert.equal(res.status, 302)
    assert.equal(res.headers.get('location'), 'http://app.smoke/auth/google/failed?reason=INVALID_STATE')
  })

  await check("staff and admin can curate the shared menu but cannot edit or delete a member's own menu", async () => {
    const own = (await call('POST', '/foods/mine', { token: member, body: { nameTh: 'แกงส้มของแม่', kcal: 300, proteinG: 20, carbG: 20, fatG: 10 } })).body.data
    const admin = (await call('POST', '/auth/login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.data.accessToken
    const body = { nameTh: 'แก้โดย admin', unit: 'serving', kcal: 1, proteinG: 0, carbG: 0, fatG: 0, verified: true }
    assert.equal((await call('PUT', `/foods/${own.id}`, { token: admin, body })).status, 404)
    assert.equal((await call('DELETE', `/foods/${own.id}`, { token: admin })).status, 404)
    const still = (await call('GET', '/foods?mine=true', { token: member })).body.data.find((f: { id: string }) => f.id === own.id)
    assert.equal(still.nameTh, 'แกงส้มของแม่')
    assert.equal(still.verified, false)
    const shared = (await call('GET', `/foods?q=${encodeURIComponent('ข้าวมันไก่')}`, { token: admin })).body.data[0]
    assert.equal((await call('PUT', `/foods/${shared.id}`, { token: admin, body: { ...shared, id: undefined, personal: undefined } })).status, 200)
  })

  await check('an admin cannot delete their own account from the user admin page', async () => {
    const admin = (await call('POST', '/auth/login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.data.accessToken
    const id = (await call('GET', '/auth/me', { token: admin })).body.data.user.id
    const res = await call('DELETE', `/users/${id}`, { token: admin })
    assert.equal(res.status, 400)
    assert.equal(res.body.message, 'CANNOT_DELETE_SELF')
    assert.equal((await call('GET', '/auth/me', { token: admin })).status, 200)
  })

  // สมัครผ่าน /auth/register ได้ชั่วโมงละ 10 ครั้ง · บัญชีทดสอบชุดหลังจึงให้ admin สร้างแล้ว login เอา
  const signup = async (username: string, firstName: string) => {
    const admin = (await call('POST', '/auth/login', { body: { username: 'admin', password: ADMIN_PASSWORD } })).body.data.accessToken
    const made = await call('POST', '/users', { token: admin, body: { username, password: 'password1', role: 'MEMBER', firstName, email: `${username}@example.com` } })
    assert.equal(made.status, 201, JSON.stringify(made.body))
    return (await call('POST', '/auth/login', { body: { username, password: 'password1' } })).body.data.accessToken as string
  }
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)

  await check("quick add: yesterday's lunch and frequent foods copy their old snapshot into today, and someone else's entry cannot be copied", async () => {
    const t = await signup('quickie', 'ควิก')
    await call('POST', `/daylogs/${yesterday}/entries`, { token: t, body: { meal: 'lunch', foodId: foods['ข้าวมันไก่'], qty: 1.5 } })
    await call('POST', `/daylogs/${yesterday}/entries`, { token: t, body: { meal: 'lunch', nameTh: 'ชาเย็น', kcal: 180 } })
    const quick = (await call('GET', `/daylogs/quick?date=${today}&meal=lunch`, { token: t })).body.data
    assert.deepEqual(quick.yesterday.map((q: { nameTh: string }) => q.nameTh), ['ข้าวมันไก่', 'ชาเย็น'])
    assert.equal(quick.frequent.length, 2)
    const from = quick.yesterday.map((q: { date: string; entryId: string }) => ({ date: q.date, entryId: q.entryId }))
    const copied = await call('POST', `/daylogs/${today}/entries/copy`, { token: t, body: { meal: 'dinner', from } })
    assert.equal(copied.status, 200, JSON.stringify(copied.body))
    assert.equal(copied.body.data.byMeal.dinner.kcal, 894 + 180)
    assert.deepEqual(copied.body.data.entries.map((e: { meal: string }) => e.meal), ['dinner', 'dinner'])
    const theirs = await call('POST', `/daylogs/${today}/entries/copy`, { token: member, body: { meal: 'lunch', from } })
    assert.equal(theirs.status, 404)
    assert.equal(theirs.body.message, 'ENTRY_NOT_FOUND')
  })

  await check('streaks count logged days back from today and earn the first badges', async () => {
    const t = (await call('POST', '/auth/login', { body: { username: 'quickie', password: 'password1' } })).body.data.accessToken
    const s = (await call('GET', `/daylogs/streaks?date=${today}`, { token: t })).body.data
    assert.deepEqual(s.streaks.log, { current: 2, best: 2, days: 2 })
    assert.equal(s.streaks.water.current, 0)
    const byId = Object.fromEntries(s.badges.map((b: { id: string }) => [b.id, b]))
    assert.equal(byId['first-log'].earned, true)
    assert.deepEqual(byId['log-3'], { id: 'log-3', progress: 2, goal: 3, earned: false })
    const range = (await call('GET', `/daylogs?from=${yesterday}&to=${today}`, { token: t })).body.data
    assert.deepEqual(range.map((p: { entries: number }) => p.entries), [2, 2])
    assert.equal(range[0].proteinG, 30)
  })

  await check('group challenge: join by invite link, members see only first names and days done, outsiders see nothing', async () => {
    const owner = await signup('groupowner', 'เจ้าของ')
    const friend = await signup('groupfriend', 'เพื่อน')
    const stranger = await signup('stranger', 'คนนอก')
    const g = (await call('POST', '/groups', { token: owner, body: { name: 'บ้านเรา', challenge: 'log' } })).body.data
    assert.equal(g.isOwner, true)
    const code = (await call('GET', `/groups/${g.id}?date=${today}`, { token: owner })).body.data.inviteCode

    const preview = await call('GET', `/groups/invite/${code}`, { token: friend })
    assert.deepEqual(preview.body.data, { name: 'บ้านเรา', challenge: 'log', memberCount: 1, alreadyMember: false, full: false })
    assert.equal((await call('POST', '/groups/join', { token: friend, body: { code } })).status, 200)
    // กดซ้ำไม่เพิ่มชื่อซ้ำ
    assert.equal((await call('POST', '/groups/join', { token: friend, body: { code } })).body.data.memberCount, 2)

    await call('POST', `/daylogs/${today}/entries`, { token: friend, body: { meal: 'breakfast', nameTh: 'ไข่ต้ม', kcal: 70 } })
    const detail = (await call('GET', `/groups/${g.id}?date=${today}`, { token: friend })).body.data
    assert.equal(detail.board.length, 2)
    assert.equal(detail.board[0].firstName, 'เพื่อน')
    assert.equal(detail.board[0].count, 1)
    assert.deepEqual(Object.keys(detail.board[0]).sort(), ['count', 'days', 'firstName', 'isMe', 'isOwner', 'userId'])

    assert.equal((await call('GET', `/groups/${g.id}?date=${today}`, { token: stranger })).status, 404)
    assert.equal((await call('POST', `/groups/${g.id}/invite-code`, { token: friend })).status, 403)
    const rotated = (await call('POST', `/groups/${g.id}/invite-code`, { token: owner })).body.data.inviteCode
    assert.notEqual(rotated, code)
    assert.equal((await call('POST', '/groups/join', { token: stranger, body: { code } })).body.message, 'INVITE_INVALID')
    assert.equal((await call('GET', '/groups/invite/not a code', { token: stranger })).status, 404)

    const me = (await call('GET', '/auth/me', { token: owner })).body.data.user.id
    assert.equal((await call('DELETE', `/groups/${g.id}/members/${me}`, { token: owner })).body.message, 'OWNER_CANNOT_LEAVE')
    // เพื่อนลบบัญชี → ชื่อหายจากกลุ่ม
    assert.equal((await call('DELETE', '/account', { token: friend, body: { confirm: 'ลบบัญชี' } })).status, 200)
    assert.equal((await call('GET', `/groups/${g.id}?date=${today}`, { token: owner })).body.data.board.length, 1)
    assert.equal((await call('DELETE', `/groups/${g.id}`, { token: owner })).status, 200)
    assert.deepEqual((await call('GET', '/groups', { token: owner })).body.data, [])
  })

  await check('security headers are set and x-powered-by is hidden', async () => {
    const res = await call('GET', '/')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.ok(res.headers.get('strict-transport-security'))
    assert.ok(res.headers.get('content-security-policy'))
    assert.equal(res.headers.get('x-powered-by'), null)
  })

  // ต้องอยู่ท้ายสุด: login ผิดครบโควตาแล้ว IP นี้ login ไม่ได้อีก 15 นาที
  await check('repeated wrong passwords get 429 instead of letting someone guess forever', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 25; i++) statuses.push((await call('POST', '/auth/login', { body: { username: 'admin', password: `guess-${i}` } })).status)
    assert.ok(statuses.includes(401))
    assert.equal(statuses.at(-1), 429)
    const blocked = await call('POST', '/auth/login', { body: { username: 'admin', password: ADMIN_PASSWORD } })
    assert.equal(blocked.status, 429)
    assert.equal(blocked.body.message, 'TOO_MANY_REQUESTS')
  })

  console.log(`\n${passed} checks passed`)
} finally {
  server.kill()
  await mongo.stop()
}
