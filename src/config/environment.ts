export type Environment = {
  PORT: string
  APP_NAME: string
  JWT_SECRET_KEY: string
  APP_ENV: string

  MONGO_URI: string
  MONGO_DB: string

  // CORS_ORIGINS — SPA origins คั่นด้วย comma (credentials ต้องระบุ origin จริง ห้าม "*")
  CORS_ORIGINS: string[]
  // CLIENT_URL — SPA origin ที่ Google callback redirect กลับไป (default = CORS_ORIGINS ตัวแรก)
  CLIENT_URL: string

  // Google OAuth — ว่างได้ (ปุ่ม Google จะตอบว่ายังไม่ได้ตั้งค่า)
  GOOGLE_OAUTH_CLIENT_ID: string
  GOOGLE_OAUTH_CLIENT_SECRET: string
  GOOGLE_OAUTH_REDIRECT_URL: string

  // รหัส admin คนแรกตอนฐานข้อมูลว่าง · ว่าง = สุ่มแล้วพิมพ์ลง log ครั้งเดียว
  SEED_ADMIN_PASSWORD: string

  // ส่งอีเมลลืมรหัสผ่าน · ว่าง = พิมพ์ลิงก์ลง log แทน
  SMTP_URL: string
  MAIL_FROM: string

  // Web Push · ว่าง = ปิดการแจ้งเตือน (สร้างคู่กุญแจด้วย npx web-push generate-vapid-keys)
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string

  // จำนวนชั้น reverse proxy หน้า API (เช่น 1) · ว่าง = ไม่มี proxy
  TRUST_PROXY: number
}

const trimEnv = (key: string) => (process.env[key] ?? '').trim()

export function isDevelopment(env: Environment): boolean {
  return env.APP_ENV.toLowerCase() === 'development'
}

export function newEnvironment(): Environment {
  const jwtSecret = trimEnv('JWT_SECRET_KEY')
  if (!jwtSecret) throw new Error('JWT_SECRET_KEY is required')
  // คีย์นี้เซ็นทั้ง JWT และลิงก์รีเซ็ตรหัสผ่าน สั้นไปเดาได้ · สร้างด้วย openssl rand -base64 48
  const appEnv = trimEnv('APP_ENV') || 'production'
  if (appEnv.toLowerCase() !== 'development' && jwtSecret.length < 32) throw new Error('JWT_SECRET_KEY must be at least 32 characters')

  const corsOrigins = trimEnv('CORS_ORIGINS').split(',').map((o) => o.trim()).filter(Boolean)
  if (corsOrigins.length === 0) corsOrigins.push('http://localhost:5190')

  return {
    PORT: trimEnv('PORT') || '8080',
    APP_NAME: trimEnv('APP_NAME'),
    JWT_SECRET_KEY: jwtSecret,
    APP_ENV: appEnv,

    MONGO_URI: trimEnv('MONGO_URI') || 'mongodb://127.0.0.1:27017',
    MONGO_DB: trimEnv('MONGO_DB') || 'dulaedee',

    CORS_ORIGINS: corsOrigins,
    CLIENT_URL: trimEnv('CLIENT_URL').replace(/\/+$/, '') || corsOrigins[0]!,

    GOOGLE_OAUTH_CLIENT_ID: trimEnv('GOOGLE_OAUTH_CLIENT_ID'),
    GOOGLE_OAUTH_CLIENT_SECRET: trimEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    GOOGLE_OAUTH_REDIRECT_URL: trimEnv('GOOGLE_OAUTH_REDIRECT_URL'),


    SEED_ADMIN_PASSWORD: trimEnv('SEED_ADMIN_PASSWORD'),

    SMTP_URL: trimEnv('SMTP_URL'),
    MAIL_FROM: trimEnv('MAIL_FROM') || 'ดูแลดี <no-reply@localhost>',

    VAPID_PUBLIC_KEY: trimEnv('VAPID_PUBLIC_KEY'),
    VAPID_PRIVATE_KEY: trimEnv('VAPID_PRIVATE_KEY'),
    VAPID_SUBJECT: trimEnv('VAPID_SUBJECT') || 'mailto:admin@localhost',

    TRUST_PROXY: Number(trimEnv('TRUST_PROXY')) || 0,
  }
}
