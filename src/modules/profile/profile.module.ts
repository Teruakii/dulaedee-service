import { Router, type Express } from 'express'
import type { Client } from '../../infra/db/mongodb.js'
import type { JWT } from '../../infra/jwt.js'
import { auth } from '../../middleware/auth.js'
import { ProfileHandler } from './profile.handler.js'
import { ProfileRepo } from './profile.repo.js'
import { ProfileService } from './profile.service.js'

export class ProfileModule {
  private readonly repo: ProfileRepo
  private readonly svc: ProfileService
  private readonly handler: ProfileHandler

  constructor(db: Client) {
    this.repo = new ProfileRepo(db)
    this.svc = new ProfileService(this.repo)
    this.handler = new ProfileHandler(this.svc)
  }

  ensureIndexes = () => this.repo.ensureIndexes()
  service = (): ProfileService => this.svc

  // ข้อมูลร่างกายเป็นของเจ้าของเท่านั้น · เครื่องคำนวณเปิดสาธารณะ
  mount(app: Express, j: JWT) {
    const r = Router()
    r.post('/calc', this.handler.calc)
    r.get('/me', auth(j), this.handler.me)
    r.put('/me', auth(j), this.handler.upsert)
    r.patch('/me/notify', auth(j), this.handler.updateNotify)
    app.use('/profile', r)
  }
}
