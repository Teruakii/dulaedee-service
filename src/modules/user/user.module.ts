import { Router, type Express } from 'express'
import type { Client } from '../../infra/db/mongodb.js'
import type { JWT } from '../../infra/jwt.js'
import type { Logger } from '../../infra/logs.js'
import { auth } from '../../middleware/auth.js'
import { UserHandler } from './user.handler.js'
import { UserRepoMongo, type UserRepo } from './user.repo.js'
import { UserService } from './user.service.js'

export class UserModule {
  private readonly repo: UserRepoMongo
  private readonly svc: UserService
  private readonly handler: UserHandler

  constructor(db: Client, logger: Logger, deleteAccount: (userID: string) => Promise<void>) {
    this.repo = new UserRepoMongo(db)
    this.svc = new UserService(logger, this.repo, deleteAccount)
    this.handler = new UserHandler(this.svc)
  }

  ensureIndexes = () => this.repo.ensureIndexes()
  service = (): UserService => this.svc
  userRepo = (): UserRepo => this.repo
  firstNames: UserRepoMongo['firstNames'] = (ids) => this.repo.firstNames(ids)

  // /users จัดการบัญชี เฉพาะ ADMIN
  mount(app: Express, j: JWT) {
    const r = Router()
    r.use(auth(j, 'ADMIN'))
    r.post('/', this.handler.create)
    r.get('/', this.handler.list)
    r.get('/:id', this.handler.getById)
    r.put('/:id', this.handler.update)
    r.delete('/:id', this.handler.delete)
    app.use('/users', r)
  }
}
