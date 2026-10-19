import type { Response } from 'express'
import { created, errorBoundary, ok, param, success, writeMapped, type ErrTable } from '../../infra/http/response.js'
import { currentUser } from '../../middleware/auth.js'
import { SlotParam } from '../daylog/daylog.dto.js'
import { ReorderRequest, UpsertProductRequest } from './skin.dto.js'
import { ErrProductNotFound } from './skin.repo.js'
import type { SkinService } from './skin.service.js'

const errTable: ErrTable = new Map([[ErrProductNotFound, 404]])

export const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)
const me = (res: Response) => currentUser(res).userID

export class SkinHandler {
  constructor(private readonly svc: SkinService) {}

  listProducts = h(async (_req, res) => {
    ok(res, await this.svc.listProducts(me(res)))
  })

  createProduct = h(async (req, res) => {
    created(res, 'SKIN_PRODUCT_CREATED', await this.svc.createProduct(me(res), UpsertProductRequest.parse(req.body)))
  })

  updateProduct = h(async (req, res) => {
    ok(res, await this.svc.updateProduct(me(res), param(req, 'id'), UpsertProductRequest.parse(req.body)))
  })

  deleteProduct = h(async (req, res) => {
    await this.svc.deleteProduct(me(res), param(req, 'id'))
    success(res, 'SKIN_PRODUCT_DELETED')
  })

  routine = h(async (req, res) => {
    ok(res, await this.svc.routine(me(res), SlotParam.parse(param(req, 'slot'))))
  })

  reorder = h(async (req, res) => {
    ok(res, await this.svc.reorder(me(res), SlotParam.parse(param(req, 'slot')), ReorderRequest.parse(req.body).productIds))
  })
}
