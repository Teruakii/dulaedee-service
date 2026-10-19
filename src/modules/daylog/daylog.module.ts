import { Router, type Express } from 'express'
import type { Client } from '../../infra/db/mongodb.js'
import type { JWT } from '../../infra/jwt.js'
import { auth } from '../../middleware/auth.js'
import type { FoodService } from '../food/food.service.js'
import type { ProfileService } from '../profile/profile.service.js'
import { DayLogHandler } from './daylog.handler.js'
import { DayLogRepo } from './daylog.repo.js'
import { DayLogService } from './daylog.service.js'

export class DayLogModule {
  private readonly repo: DayLogRepo
  private readonly svc: DayLogService
  private readonly handler: DayLogHandler

  constructor(db: Client, profiles: ProfileService, foods: FoodService) {
    this.repo = new DayLogRepo(db)
    this.svc = new DayLogService(this.repo, profiles, foods)
    this.handler = new DayLogHandler(this.svc)
  }

  ensureIndexes = () => this.repo.ensureIndexes()
  service = (): DayLogService => this.svc

  // บันทึกประจำวันของตัวเองเท่านั้น (userId มาจาก token ไม่รับจาก client)
  mount(app: Express, j: JWT) {
    const r = Router()
    r.use(auth(j))
    r.get('/', this.handler.range)
    r.get('/quick', this.handler.quick)
    r.get('/streaks', this.handler.streaks)
    r.get('/:date', this.handler.day)
    r.post('/:date/entries', this.handler.addEntry)
    r.post('/:date/entries/copy', this.handler.copyEntries)
    r.delete('/:date/entries/:entryId', this.handler.removeEntry)
    r.post('/:date/workouts', this.handler.addWorkout)
    r.delete('/:date/workouts/:workoutId', this.handler.removeWorkout)
    r.post('/:date/water', this.handler.addWater)
    r.put('/:date/weight', this.handler.setWeight)
    r.put('/:date/skin/:slot', this.handler.setSkinDone)
    app.use('/daylogs', r)
  }
}
