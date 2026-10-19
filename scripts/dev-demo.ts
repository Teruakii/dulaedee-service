// เปิด API ที่ port 3200 กับ MongoDB ในหน่วยความจำ แล้วใส่ข้อมูลตัวอย่างตาม mockup ผ่าน HTTP
// ใช้ดูหน้าเว็บจริงโดยไม่ต้องติดตั้ง MongoDB · ปิดแล้วข้อมูลหายหมด
import { MongoMemoryServer } from 'mongodb-memory-server'
import webpush from 'web-push'

const PORT = 3200
const BASE = `http://127.0.0.1:${PORT}`
export const DEMO = { username: 'mind', email: 'mind@example.com', password: 'password1', adminPassword: 'admin-demo-pass' }

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = (await res.json()) as { data?: any; message?: string }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json.message}`)
  return json.data
}

const mongo = await MongoMemoryServer.create()
// demo ข้อมูลหายทุกครั้งที่ปิด กุญแจ push จึงสร้างใหม่ได้
const vapid = webpush.generateVAPIDKeys()
// รัน server ใน process เดียวกัน: ปิดสคริปต์ครั้งเดียวปิดหมด ไม่มี server ค้างถือ port
// (dotenv ไม่ทับค่าที่ตั้งไว้แล้ว ค่าด้านล่างจึงชนะ .env)
Object.assign(process.env, {
  PORT: String(PORT),
  APP_ENV: 'development',
  MONGO_URI: mongo.getUri(),
  MONGO_DB: 'dulaedee_demo',
  SEED_ADMIN_PASSWORD: DEMO.adminPassword,
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  CORS_ORIGINS: 'http://localhost:5190',
})
process.on('exit', () => void mongo.stop())
await import('../src/main.js')

for (let i = 0; !(await fetch(BASE).then((r) => r.ok, () => false)); i++) {
  if (i > 60) throw new Error('server did not start')
  await new Promise((r) => setTimeout(r, 500))
}

const day = (offset: number) => new Date(Date.now() + 7 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10)
const today = day(0)

const reg = await call('POST', '/auth/register', undefined, {
  username: DEMO.username,
  email: DEMO.email,
  password: DEMO.password,
  firstName: 'มายด์',
  acceptTerms: true,
  acceptPrivacy: true,
})
const t: string = reg.accessToken

await call('PUT', '/profile/me', t, {
  sex: 'female',
  birthYear: new Date().getFullYear() - 28,
  heightCm: 160,
  weightKg: 58,
  activity: 'light',
  goal: 'lose',
  skinType: 'combination',
  skinConcerns: ['acne'],
})

// น้ำหนักลดจาก 59.4 เหลือ 58.0 ใน 30 วัน ชั่งวันเว้นวัน
for (let i = 29; i >= 0; i -= 2) await call('PUT', `/daylogs/${day(-i)}/weight`, t, { weightKg: Math.round((58 + (i / 29) * 1.4) * 10) / 10 })
await call('PUT', `/daylogs/${today}/weight`, t, { weightKg: 58 })

const foods: { id: string; nameTh: string }[] = await call('GET', '/foods?limit=100', t)
const foodId = (name: string) => foods.find((f) => f.nameTh === name)!.id
await call('POST', `/daylogs/${today}/entries`, t, { meal: 'breakfast', foodId: foodId('โจ๊กหมูใส่ไข่') })
await call('POST', `/daylogs/${today}/entries`, t, { meal: 'lunch', foodId: foodId('ข้าวมันไก่') })

const waterByDay = [1750, 2000, 1500, 2250, 2000, 1750, 1250]
for (const [i, ml] of waterByDay.entries()) await call('POST', `/daylogs/${day(i - 6)}/water`, t, { deltaMl: ml })

const product = (body: object) => call('POST', '/skin/products', t, body)
const cleanser = await product({ name: 'คลีนซิ่งโฟมสูตรอ่อนโยน', step: 'cleanser', slots: ['am', 'pm'] })
await product({ name: 'โทนเนอร์ AHA 5%', step: 'toner', actives: ['aha'], slots: ['pm'] })
await product({ name: 'เซรั่มเรตินอล 0.3%', step: 'serum', actives: ['retinol'], slots: ['pm'] })
await product({ name: 'มอยส์เจอไรเซอร์เนื้อเจล', step: 'moisturizer', actives: ['niacinamide'], slots: ['pm'] })
await product({ name: 'เซรั่มวิตามินซี', step: 'serum', actives: ['vitamin_c'], slots: ['am'] })
await product({ name: 'กันแดด SPF50', step: 'sunscreen', actives: ['spf'], slots: ['am'] })
for (let i = 6; i >= 1; i--) if (i !== 1) await call('PUT', `/daylogs/${day(-i)}/skin/pm`, t, { done: [cleanser.id] })
await call('PUT', `/daylogs/${today}/skin/pm`, t, { done: [cleanser.id] })

// ตารางออกกำลังกายที่ผู้ใช้กรอกเอง
const plan: [number, { name: string; minutes: number; kcal?: number }[]][] = [
  [0, [{ name: 'เดินเร็ว', minutes: 30, kcal: 120 }]],
  [1, [{ name: 'สควอท + แพลงก์', minutes: 15 }]],
  [2, [{ name: 'วิ่งเหยาะ', minutes: 25, kcal: 200 }]],
  [3, [{ name: 'โยคะ', minutes: 20 }]],
  [4, [{ name: 'เต้นแอโรบิก', minutes: 30, kcal: 210 }]],
  [5, [{ name: 'ปั่นจักรยาน', minutes: 40 }]],
]
for (const [weekday, items] of plan) await call('PUT', `/workouts/plan/days/${weekday}`, t, { items })

console.log(`\nDEMO READY · member ${DEMO.email} / ${DEMO.password} · admin admin / ${DEMO.adminPassword}`)
