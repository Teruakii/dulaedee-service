import { Router, type Express, type Response } from 'express'
import type { Client } from '../../infra/db/mongodb.js'
import { errorBoundary, ok, param, success, writeMapped, type ErrTable } from '../../infra/http/response.js'
import type { JWT } from '../../infra/jwt.js'
import { auth, currentUser } from '../../middleware/auth.js'
import type { DayLogService } from '../daylog/daylog.service.js'
import { BoardQuery, CodeParam, JoinRequest, UpsertGroupRequest } from './group.dto.js'
import { ErrGroupFull, ErrGroupNotFound, ErrInviteInvalid, GroupRepo } from './group.repo.js'
import { ErrGroupLimit, ErrNotGroupOwner, ErrOwnerCannotLeave, GroupService } from './group.service.js'

const errTable: ErrTable = new Map([
  [ErrGroupNotFound, 404],
  [ErrInviteInvalid, 404],
  [ErrGroupFull, 409],
  [ErrGroupLimit, 409],
  [ErrNotGroupOwner, 403],
  [ErrOwnerCannotLeave, 400],
])
export const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)
const me = (res: Response) => currentUser(res).userID

// รหัสชวนผิดรูปแบบ = ลิงก์ใช้ไม่ได้ ไม่ใช่ 400
const codeOf = (raw: string) => {
  const r = CodeParam.safeParse(raw)
  if (!r.success) throw ErrInviteInvalid
  return r.data
}

// ชาเลนจ์กลุ่ม: ชวนกันด้วยลิงก์ เห็นแค่ชื่อเล่นและจำนวนวันที่ทำครบในสัปดาห์ · handler อยู่ในไฟล์นี้เหมือน workout
export class GroupModule {
  private readonly repo: GroupRepo
  private readonly svc: GroupService

  constructor(db: Client, days: DayLogService, firstNames: ConstructorParameters<typeof GroupService>[2]) {
    this.repo = new GroupRepo(db)
    this.svc = new GroupService(this.repo, days, firstNames)
  }

  ensureIndexes = () => this.repo.ensureIndexes()

  mount(app: Express, j: JWT) {
    const r = Router()
    r.use(auth(j))
    r.get('/', h(async (_req, res) => ok(res, await this.svc.list(me(res)))))
    r.post('/', h(async (req, res) => ok(res, await this.svc.create(me(res), UpsertGroupRequest.parse(req.body)))))
    r.get('/invite/:code', h(async (req, res) => ok(res, await this.svc.preview(me(res), codeOf(param(req, 'code'))))))
    r.post('/join', h(async (req, res) => ok(res, await this.svc.join(me(res), JoinRequest.parse(req.body).code))))
    r.get('/:id', h(async (req, res) => ok(res, await this.svc.detail(me(res), param(req, 'id'), BoardQuery.parse(req.query).date))))
    r.put('/:id', h(async (req, res) => ok(res, await this.svc.update(me(res), param(req, 'id'), UpsertGroupRequest.parse(req.body)))))
    r.post('/:id/invite-code', h(async (req, res) => ok(res, await this.svc.rotateCode(me(res), param(req, 'id')))))
    r.delete(
      '/:id/members/:userId',
      h(async (req, res) => {
        await this.svc.removeMember(me(res), param(req, 'id'), param(req, 'userId'))
        success(res, 'MEMBER_REMOVED')
      }),
    )
    r.delete(
      '/:id',
      h(async (req, res) => {
        await this.svc.delete(me(res), param(req, 'id'))
        success(res, 'GROUP_DELETED')
      }),
    )
    app.use('/groups', r)
  }
}
