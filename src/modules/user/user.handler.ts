import type { Response } from 'express'
import { created, errorBoundary, ok, okPaginated, param, success, writeMapped, type ErrTable } from '../../infra/http/response.js'
import { currentUser } from '../../middleware/auth.js'
import { CreateUserRequest, ListUsersQuery, UpdateUserRequest } from './user.dto.js'
import { ErrEmailExists, ErrUserNotFound, ErrUsernameExists } from './user.repo.js'
import { ErrCannotDeleteSelf, type UserService } from './user.service.js'

const errTable: ErrTable = new Map([
  [ErrUserNotFound, 404],
  [ErrUsernameExists, 400],
  [ErrEmailExists, 400],
  [ErrCannotDeleteSelf, 400],
])

export const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)

export class UserHandler {
  constructor(private readonly svc: UserService) {}

  create = h(async (req, res) => {
    created(res, 'USER_CREATED', await this.svc.create(CreateUserRequest.parse(req.body)))
  })

  getById = h(async (req, res) => {
    ok(res, await this.svc.getById(param(req, 'id')))
  })

  list = h(async (req, res) => {
    const q = ListUsersQuery.parse(req.query)
    const { rows, hasMore } = await this.svc.list(q)
    okPaginated(res, rows, q.page, q.limit, hasMore)
  })

  update = h(async (req, res) => {
    ok(res, await this.svc.update(param(req, 'id'), UpdateUserRequest.parse(req.body)))
  })

  delete = h(async (req, res) => {
    await this.svc.delete(currentUser(res).userID, param(req, 'id'))
    success(res, 'USER_DELETED')
  })
}
