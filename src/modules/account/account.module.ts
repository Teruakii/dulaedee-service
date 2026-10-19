import { Router, type Express, type Response } from 'express'
import { z } from 'zod'
import type { Client } from '../../infra/db/mongodb.js'
import { errorBoundary, success, writeMapped, type ErrTable } from '../../infra/http/response.js'
import type { JWT } from '../../infra/jwt.js'
import { auth, currentUser } from '../../middleware/auth.js'
import { clearCookie, REFRESH_COOKIE } from '../auth/auth.utils.js'
import { AccountService, ErrAccountNotFound } from './account.service.js'

// ต้องพิมพ์คำยืนยันเอง กันกดพลาด · ไม่ใช้รหัสผ่านเพราะบัญชี Google ไม่มีรหัสผ่าน
export const DELETE_CONFIRM = 'ลบบัญชี'
const DeleteRequest = z.object({ confirm: z.literal(DELETE_CONFIRM) })

const errTable: ErrTable = new Map([[ErrAccountNotFound, 404]])
const h = errorBoundary((res: Response, err: unknown) => writeMapped(res, err, errTable))
const me = (res: Response) => currentUser(res).userID

export class AccountModule {
  private readonly svc: AccountService

  constructor(db: Client) {
    this.svc = new AccountService(db.db)
  }

  service = (): AccountService => this.svc

  mount(app: Express, j: JWT) {
    const r = Router()
    r.use(auth(j))
    r.delete('/', h(async (req, res) => {
      DeleteRequest.parse(req.body)
      await this.svc.delete(me(res))
      clearCookie(res, REFRESH_COOKIE, '/')
      success(res, 'ACCOUNT_DELETED')
    }))
    app.use('/account', r)
  }
}
