import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { apiLimit } from './middleware/rateLimit.js'
import { newEnvironment } from './config/environment.js'
import { newClient } from './infra/db/mongodb.js'
import { internalError } from './infra/http/response.js'
import { JWT } from './infra/jwt.js'
import { Logger } from './infra/logs.js'
import { newGoogleOAuth } from './infra/oauth/google.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { ClipModule } from './modules/clip/clip.module.js'
import { DayLogModule } from './modules/daylog/daylog.module.js'
import { FoodModule } from './modules/food/food.module.js'
import { ProfileModule } from './modules/profile/profile.module.js'
import { SkinModule } from './modules/skin/skin.module.js'
import { UserModule } from './modules/user/user.module.js'
import { WeatherModule } from './modules/weather/weather.module.js'
import { WorkoutModule } from './modules/workout/workout.module.js'
import { logMailer, smtpMailer } from './infra/mail/mailer.js'
import { AccountModule } from './modules/account/account.module.js'
import { PushModule } from './modules/push/push.module.js'
import { GroupModule } from './modules/group/group.module.js'

const VERSION = '0.1.0'

async function main() {
  const logger = new Logger()

  let cfg
  try {
    cfg = newEnvironment()
  } catch (err) {
    logger.error('ERROR_LOADING_ENV', err)
    process.exit(1)
  }

  const db = await newClient({ uri: cfg.MONGO_URI, dbName: cfg.MONGO_DB }).catch((err) => {
    logger.error('ERROR_CONNECTING_DATABASE', err)
    process.exit(1)
  })

  const app = express()
  app.disable('x-powered-by')
  // หลัง reverse proxy ต้องบอกจำนวนชั้น ไม่งั้น rate limit นับทุกคนเป็น IP ของ proxy
  if (cfg.TRUST_PROXY) app.set('trust proxy', cfg.TRUST_PROXY)
  app.use(helmet())
  app.use(apiLimit)
  app.use(cors({ origin: cfg.CORS_ORIGINS, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }))
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  const jwt = new JWT(cfg.JWT_SECRET_KEY)

  app.get('/', (_req, res) => {
    res.json({ code: 200, message: `${cfg.APP_NAME || 'dulaedee'} service is running v${VERSION}` })
  })

  const accountModule = new AccountModule(db)
  const userModule = new UserModule(db, logger, (id) => accountModule.service().delete(id))
  const authModule = new AuthModule({
    userRepo: userModule.userRepo(),
    logger,
    jwt,
    google: newGoogleOAuth(cfg.GOOGLE_OAUTH_CLIENT_ID, cfg.GOOGLE_OAUTH_CLIENT_SECRET, cfg.GOOGLE_OAUTH_REDIRECT_URL),
    clientURL: cfg.CLIENT_URL,
    mailer: cfg.SMTP_URL ? smtpMailer(cfg.SMTP_URL, cfg.MAIL_FROM) : logMailer(logger),
    resetSecret: cfg.JWT_SECRET_KEY,
  })

  // ---------- สุขภาพ ----------
  const profileModule = new ProfileModule(db)
  const foodModule = new FoodModule(db)
  const workoutModule = new WorkoutModule(db)
  const dayLogModule = new DayLogModule(db, profileModule.service(), foodModule.service())
  const skinModule = new SkinModule(db)
  const clipModule = new ClipModule(db)
  const weatherModule = new WeatherModule(logger)
  const groupModule = new GroupModule(db, dayLogModule.service(), userModule.firstNames)
  const pushModule = new PushModule(db, {
    vapid: cfg.VAPID_PUBLIC_KEY && cfg.VAPID_PRIVATE_KEY ? { publicKey: cfg.VAPID_PUBLIC_KEY, privateKey: cfg.VAPID_PRIVATE_KEY, subject: cfg.VAPID_SUBJECT } : null,
    logger,
    profiles: profileModule.service(),
    days: dayLogModule.service(),
    weather: weatherModule.service(),
  })

  try {
    for (const ensure of [
      userModule.ensureIndexes,
      profileModule.ensureIndexes,
      foodModule.ensureIndexes,
      dayLogModule.ensureIndexes,
      skinModule.ensureIndexes,
      clipModule.ensureIndexes,
      workoutModule.ensureIndexes,
      pushModule.ensureIndexes,
      groupModule.ensureIndexes,
    ]) {
      await ensure()
    }
    await userModule.service().ensureSeedDefaultAdmin(cfg.SEED_ADMIN_PASSWORD)
    const seeded = await foodModule.service().seed()
    if (seeded > 0) logger.info('SEED_FOODS_CREATED', { count: seeded })
    const clips = await clipModule.seed(await foodModule.service().names())
    if (clips > 0) logger.info('SEED_CLIPS_CREATED', { count: clips })
  } catch (err) {
    logger.error('ERROR_PREPARING_DATABASE', err)
    process.exit(1)
  }

  authModule.mount(app)
  userModule.mount(app, jwt)
  profileModule.mount(app, jwt)
  foodModule.mount(app, jwt)
  dayLogModule.mount(app, jwt)
  skinModule.mount(app, jwt)
  clipModule.mount(app, jwt)
  weatherModule.mount(app, jwt)
  workoutModule.mount(app, jwt)
  accountModule.mount(app, jwt)
  pushModule.mount(app, jwt)
  groupModule.mount(app, jwt)

  // JSON พังหรือ error ที่หลุดจาก handler ยังตอบรูปแบบเดียวกับ response helper
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ code: 400, message: 'INVALID_JSON' })
    internalError(res, err)
  })

  const server = app.listen(Number(cfg.PORT), () => logger.info('SERVER_STARTED', { port: cfg.PORT }))

  const shutdown = () => {
    server.close(() => void db.close().finally(() => process.exit(0)))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

void main()
