import type { Response } from 'express'
import { created, errorBoundary, ok, okPaginated, param, success, writeMapped, type ErrTable } from '../../infra/http/response.js'
import { ListClipsQuery, RecommendClipsQuery, UpsertClipRequest } from './clip.dto.js'
import { ErrClipDuplicate, ErrClipNotFound } from './clip.repo.js'
import type { ClipService } from './clip.service.js'

const errTable: ErrTable = new Map([
  [ErrClipNotFound, 404],
  [ErrClipDuplicate, 400],
])

export const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)

export class ClipHandler {
  constructor(private readonly svc: ClipService) {}

  list = h(async (req, res) => {
    const q = ListClipsQuery.parse(req.query)
    const { rows, hasMore } = await this.svc.list(q)
    okPaginated(res, rows, q.page, q.limit, hasMore)
  })

  recommend = h(async (req, res) => {
    ok(res, await this.svc.recommend(RecommendClipsQuery.parse(req.query)))
  })

  create = h(async (req, res) => {
    created(res, 'CLIP_CREATED', await this.svc.create(UpsertClipRequest.parse(req.body)))
  })

  update = h(async (req, res) => {
    ok(res, await this.svc.update(param(req, 'id'), UpsertClipRequest.parse(req.body)))
  })

  delete = h(async (req, res) => {
    await this.svc.delete(param(req, 'id'))
    success(res, 'CLIP_DELETED')
  })
}
