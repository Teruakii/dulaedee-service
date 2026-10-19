import { Router, type Express } from 'express'
import type { Client } from '../../infra/db/mongodb.js'
import type { JWT } from '../../infra/jwt.js'
import { auth } from '../../middleware/auth.js'
import { ClipHandler } from './clip.handler.js'
import { ClipRepo } from './clip.repo.js'
import type { FoodTag } from '../food/food.model.js'
import { ClipService } from './clip.service.js'
import { SEED_CLIPS } from './clip.seed.js'

export class ClipModule {
  private readonly repo: ClipRepo
  private readonly handler: ClipHandler

  constructor(db: Client) {
    this.repo = new ClipRepo(db)
    this.handler = new ClipHandler(new ClipService(this.repo))
  }

  ensureIndexes = () => this.repo.ensureIndexes()

  // แปลงชื่อเมนูเป็น id ด้วยเมนูที่มีในฐานข้อมูล · เมนูที่หาไม่เจอก็ข้ามไป คลิปยังอยู่
  seed = async (foods: { nameTh: string; id: string; tags: FoodTag[] }[]): Promise<number> => {
    const byName = new Map(foods.map((f) => [f.nameTh, f]))
    return this.repo.seedIfEmpty(
      SEED_CLIPS.map(({ foods: names, ...c }) => {
        const linked = names.flatMap((n) => byName.get(n) ?? [])
        return { ...c, foodIds: linked.map((f) => f.id), tags: [...new Set(linked.flatMap((f) => f.tags))] }
      }),
    )
  }

  // ทุกคนที่ login ดูได้ · ADMIN/STAFF คัดคลิปเข้าออก
  mount(app: Express, j: JWT) {
    const r = Router()
    r.use(auth(j))
    r.get('/', this.handler.list)
    r.get('/recommend', this.handler.recommend)
    r.post('/', auth(j, 'ADMIN', 'STAFF'), this.handler.create)
    r.put('/:id', auth(j, 'ADMIN', 'STAFF'), this.handler.update)
    r.delete('/:id', auth(j, 'ADMIN', 'STAFF'), this.handler.delete)
    app.use('/clips', r)
  }
}
