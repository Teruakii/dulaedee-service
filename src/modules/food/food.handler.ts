import type { Response } from 'express'
import { created, errorBoundary, ok, okPaginated, param, success, writeMapped, type ErrTable } from '../../infra/http/response.js'
import { currentUser } from '../../middleware/auth.js'
import { CreateMyFoodRequest, ListFoodsQuery, RecommendQuery, UpsertFoodRequest } from './food.dto.js'
import { ErrFoodNotFound, ErrInvalidFoodID } from './food.repo.js'
import type { FoodService } from './food.service.js'

const errTable: ErrTable = new Map([
  [ErrFoodNotFound, 404],
  [ErrInvalidFoodID, 400],
])

export const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)
const me = (res: Response) => currentUser(res).userID

export class FoodHandler {
  constructor(private readonly svc: FoodService) {}

  list = h(async (req, res) => {
    const q = ListFoodsQuery.parse(req.query)
    const { rows, hasMore } = await this.svc.list(q, me(res))
    okPaginated(res, rows, q.page, q.limit, hasMore)
  })

  recommend = h(async (req, res) => {
    ok(res, await this.svc.recommend(RecommendQuery.parse(req.query), me(res)))
  })

  get = h(async (req, res) => {
    ok(res, await this.svc.get(param(req, 'id'), me(res)))
  })

  createMine = h(async (req, res) => {
    created(res, 'FOOD_CREATED', await this.svc.createMine(CreateMyFoodRequest.parse(req.body), me(res)))
  })

  deleteMine = h(async (req, res) => {
    await this.svc.deleteMine(param(req, 'id'), me(res))
    success(res, 'FOOD_DELETED')
  })

  create = h(async (req, res) => {
    created(res, 'FOOD_CREATED', await this.svc.create(UpsertFoodRequest.parse(req.body)))
  })

  update = h(async (req, res) => {
    ok(res, await this.svc.update(param(req, 'id'), UpsertFoodRequest.parse(req.body)))
  })

  delete = h(async (req, res) => {
    await this.svc.delete(param(req, 'id'))
    success(res, 'FOOD_DELETED')
  })
}
