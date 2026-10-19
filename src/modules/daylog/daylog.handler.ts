import type { Request, Response } from 'express'
import { errorBoundary, ok, param, writeMapped, type ErrTable } from '../../infra/http/response.js'
import { currentUser } from '../../middleware/auth.js'
import { ErrFoodNotFound, ErrInvalidFoodID } from '../food/food.repo.js'
import {
  AddEntryRequest,
  AddWaterRequest,
  AddWorkoutRequest,
  CopyEntriesRequest,
  DateParam,
  QuickQuery,
  RangeQuery,
  SetSkinDoneRequest,
  SetWeightRequest,
  SlotParam,
  TodayQuery,
} from './daylog.dto.js'
import { ErrEntryNotFound, ErrWorkoutLogNotFound } from './daylog.repo.js'
import { ErrInvalidRange, type DayLogService } from './daylog.service.js'

const errTable: ErrTable = new Map([
  [ErrEntryNotFound, 404],
  [ErrWorkoutLogNotFound, 404],
  [ErrFoodNotFound, 404],
  [ErrInvalidFoodID, 400],
  [ErrInvalidRange, 400],
])

export const writeErr = (res: Response, err: unknown) => writeMapped(res, err, errTable)
const h = errorBoundary(writeErr)

const dateOf = (req: Request) => DateParam.parse(param(req, 'date'))
const me = (res: Response) => currentUser(res).userID

export class DayLogHandler {
  constructor(private readonly svc: DayLogService) {}

  day = h(async (req, res) => {
    ok(res, await this.svc.day(me(res), dateOf(req)))
  })

  range = h(async (req, res) => {
    ok(res, await this.svc.range(me(res), RangeQuery.parse(req.query)))
  })

  addEntry = h(async (req, res) => {
    ok(res, await this.svc.addEntry(me(res), dateOf(req), AddEntryRequest.parse(req.body)))
  })

  quick = h(async (req, res) => {
    ok(res, await this.svc.quick(me(res), QuickQuery.parse(req.query)))
  })

  copyEntries = h(async (req, res) => {
    ok(res, await this.svc.copyEntries(me(res), dateOf(req), CopyEntriesRequest.parse(req.body)))
  })

  // "วันนี้" มาจาก client เหมือน endpoint อื่นของ daylog
  streaks = h(async (req, res) => {
    ok(res, await this.svc.streaks(me(res), TodayQuery.parse(req.query).date))
  })

  removeEntry = h(async (req, res) => {
    ok(res, await this.svc.removeEntry(me(res), dateOf(req), param(req, 'entryId')))
  })

  addWorkout = h(async (req, res) => {
    ok(res, await this.svc.addWorkout(me(res), dateOf(req), AddWorkoutRequest.parse(req.body)))
  })

  removeWorkout = h(async (req, res) => {
    ok(res, await this.svc.removeWorkout(me(res), dateOf(req), param(req, 'workoutId')))
  })

  addWater = h(async (req, res) => {
    ok(res, await this.svc.addWater(me(res), dateOf(req), AddWaterRequest.parse(req.body).deltaMl))
  })

  setWeight = h(async (req, res) => {
    ok(res, await this.svc.setWeight(me(res), dateOf(req), SetWeightRequest.parse(req.body).weightKg))
  })

  setSkinDone = h(async (req, res) => {
    const slot = SlotParam.parse(param(req, 'slot'))
    ok(res, await this.svc.setSkinDone(me(res), dateOf(req), slot, SetSkinDoneRequest.parse(req.body).done))
  })
}
