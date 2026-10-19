import { Router, type Express, type Response } from 'express'
import type { Client } from '../../infra/db/mongodb.js'
import { errorBoundary, ok, param, writeMapped, type ErrTable } from '../../infra/http/response.js'
import type { JWT } from '../../infra/jwt.js'
import { auth, currentUser } from '../../middleware/auth.js'
import { SetDayRequest, WeekdayParam } from './workout.dto.js'
import { PlanRepo } from './workout.repo.js'
import { WorkoutService } from './workout.service.js'

const errTable: ErrTable = new Map()
export const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)
const me = (res: Response) => currentUser(res).userID

// module เล็ก handler อยู่ในไฟล์นี้
export class WorkoutModule {
  private readonly plans: PlanRepo
  private readonly svc: WorkoutService

  constructor(db: Client) {
    this.plans = new PlanRepo(db)
    this.svc = new WorkoutService(this.plans)
  }

  ensureIndexes = () => this.plans.ensureIndexes()

  mount(app: Express, j: JWT) {
    const r = Router()
    r.use(auth(j))
    r.get('/plan', h(async (_req, res) => ok(res, await this.svc.plan(me(res)))))
    r.put(
      '/plan/days/:weekday',
      h(async (req, res) => ok(res, await this.svc.setDay(me(res), WeekdayParam.parse(param(req, 'weekday')), SetDayRequest.parse(req.body).items))),
    )
    app.use('/workouts', r)
  }
}
