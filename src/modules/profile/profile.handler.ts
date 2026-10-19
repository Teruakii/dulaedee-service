import type { Response } from 'express'
import { errorBoundary, ok, writeMapped, type ErrTable } from '../../infra/http/response.js'
import { currentUser } from '../../middleware/auth.js'
import { CalcRequest, UpdateNotifyRequest, UpsertProfileRequest } from './profile.dto.js'
import { ErrProfileNotFound } from './profile.repo.js'
import type { ProfileService } from './profile.service.js'

const errTable: ErrTable = new Map([[ErrProfileNotFound, 404]])

export const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)

export class ProfileHandler {
  constructor(private readonly svc: ProfileService) {}

  me = h(async (_req, res) => {
    ok(res, await this.svc.me(currentUser(res).userID))
  })

  upsert = h(async (req, res) => {
    ok(res, await this.svc.upsert(currentUser(res).userID, UpsertProfileRequest.parse(req.body)))
  })

  updateNotify = h(async (req, res) => {
    ok(res, await this.svc.updateNotify(currentUser(res).userID, UpdateNotifyRequest.parse(req.body)))
  })

  calc = h(async (req, res) => {
    ok(res, this.svc.calc(CalcRequest.parse(req.body)))
  })
}
