import { Router, type Express } from 'express'
import type { Client } from '../../infra/db/mongodb.js'
import type { JWT } from '../../infra/jwt.js'
import { auth } from '../../middleware/auth.js'
import { FoodHandler } from './food.handler.js'
import { FoodRepo } from './food.repo.js'
import { FoodService } from './food.service.js'

export class FoodModule {
  private readonly repo: FoodRepo
  private readonly svc: FoodService
  private readonly handler: FoodHandler

  constructor(db: Client) {
    this.repo = new FoodRepo(db)
    this.svc = new FoodService(this.repo)
    this.handler = new FoodHandler(this.svc)
  }

  ensureIndexes = () => this.repo.ensureIndexes()
  service = (): FoodService => this.svc

  // ทุกคนที่ login ค้นและดูคำแนะนำได้ และเพิ่ม/ลบเมนูของตัวเองที่ /mine · ADMIN/STAFF แก้ฐานเมนูกลาง · ลบได้เฉพาะ ADMIN
  mount(app: Express, j: JWT) {
    const r = Router()
    r.use(auth(j))
    r.get('/', this.handler.list)
    r.get('/recommend', this.handler.recommend)
    r.post('/mine', this.handler.createMine)
    r.delete('/mine/:id', this.handler.deleteMine)
    r.get('/:id', this.handler.get)
    r.post('/', auth(j, 'ADMIN', 'STAFF'), this.handler.create)
    r.put('/:id', auth(j, 'ADMIN', 'STAFF'), this.handler.update)
    r.delete('/:id', auth(j, 'ADMIN'), this.handler.delete)
    app.use('/foods', r)
  }
}
