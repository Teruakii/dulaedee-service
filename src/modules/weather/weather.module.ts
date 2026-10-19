import { Router, type Express, type Response } from 'express'
import { z } from 'zod'
import { sentinel } from '../../constants/errors.js'
import { errorBoundary, ok, writeMapped, type ErrTable } from '../../infra/http/response.js'
import type { JWT } from '../../infra/jwt.js'
import type { Logger } from '../../infra/logs.js'
import { auth } from '../../middleware/auth.js'
import { WeatherService } from './weather.service.js'

export const ErrWeatherUnavailable = sentinel('WEATHER_UNAVAILABLE')

// ไม่ส่งพิกัดมา ใช้กรุงเทพฯ
const WeatherQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).default(13.75),
  lon: z.coerce.number().min(-180).max(180).default(100.5),
})

const errTable: ErrTable = new Map([[ErrWeatherUnavailable, 503]])
const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)

// module เล็ก ไม่มี repo · handler อยู่ในไฟล์นี้
export class WeatherModule {
  constructor(
    private readonly logger: Logger,
    private readonly svc = new WeatherService(),
  ) {}

  service = (): WeatherService => this.svc

  private summary = h(async (req, res) => {
    const q = WeatherQuery.parse(req.query)
    try {
      ok(res, await this.svc.summary(q.lat, q.lon))
    } catch (err) {
      // บริการภายนอกล่ม ไม่ให้หน้าวันนี้พังทั้งหน้า ตอบ 503 ให้ client ซ่อนการ์ด
      this.logger.error('ERROR_FETCHING_WEATHER', err)
      throw ErrWeatherUnavailable
    }
  })

  mount(app: Express, j: JWT) {
    const r = Router()
    r.get('/', auth(j), this.summary)
    app.use('/weather', r)
  }
}
