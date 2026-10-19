import { Router, type Express } from 'express'
import type { Client } from '../../infra/db/mongodb.js'
import type { JWT } from '../../infra/jwt.js'
import { auth } from '../../middleware/auth.js'
import { SkinHandler } from './skin.handler.js'
import { SkinProductRepo } from './skin.repo.js'
import { SkinService } from './skin.service.js'

export class SkinModule {
  private readonly products: SkinProductRepo
  private readonly handler: SkinHandler

  constructor(db: Client) {
    this.products = new SkinProductRepo(db)
    this.handler = new SkinHandler(new SkinService(this.products))
  }

  ensureIndexes = () => this.products.ensureIndexes()

  // ข้อมูลผิวเป็นของเจ้าของเท่านั้น ทุก query กรองด้วย userId จาก token
  mount(app: Express, j: JWT) {
    const r = Router()
    r.use(auth(j))
    r.get('/products', this.handler.listProducts)
    r.post('/products', this.handler.createProduct)
    r.put('/products/:id', this.handler.updateProduct)
    r.delete('/products/:id', this.handler.deleteProduct)
    r.get('/routine/:slot', this.handler.routine)
    r.put('/routine/:slot/order', this.handler.reorder)
    app.use('/skin', r)
  }
}
