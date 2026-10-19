import { ObjectId } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import type { FoodService } from '../food/food.service.js'
import type { Targets } from '../profile/calc.js'
import { ErrProfileNotFound } from '../profile/profile.repo.js'
import type { ProfileService } from '../profile/profile.service.js'
import { addDays, byMeal, daysBetween, remainingOf, scaleMacros, sumMacros, todayBangkok } from './calc.js'
import { MAX_RANGE_DAYS, type AddEntryRequest, type AddWorkoutRequest, type CopyEntriesRequest, type QuickQuery, type RangeQuery } from './daylog.dto.js'
import type { DayLog, DaySummary, Entry, RangePoint, SkinSlot, WorkoutLog } from './daylog.model.js'
import { ErrEntryNotFound, ErrWorkoutLogNotFound, type DayLogRepo } from './daylog.repo.js'
import { frequentFoods, mealOf, type QuickItem } from './quick.js'
import { badgesOf, streaksOf, type Badge, type DayFacts, type Streaks } from './streaks.js'

export const ErrInvalidRange = sentinel('INVALID_DATE_RANGE')

// ยังไม่ได้ตั้งข้อมูลร่างกาย ใช้เป้าน้ำมาตรฐานแทน
export const DEFAULT_WATER_ML = 2000
// "กินบ่อย" ดูย้อนหลัง 30 วัน
const FREQUENT_DAYS = 30

const parseEntryID = (id: string) => {
  if (!ObjectId.isValid(id)) throw ErrEntryNotFound
  return new ObjectId(id)
}

export class DayLogService {
  constructor(
    private readonly repo: DayLogRepo,
    private readonly profiles: ProfileService,
    private readonly foods: FoodService,
  ) {}

  async day(userID: string, date: string): Promise<DaySummary> {
    const uid = new ObjectId(userID)
    const [log, targets] = await Promise.all([this.repo.get(uid, date), this.targetsOrNull(userID)])
    return summarize(date, log, targets)
  }

  async range(userID: string, q: RangeQuery): Promise<RangePoint[]> {
    const span = daysBetween(q.from, q.to)
    if (span < 0 || span >= MAX_RANGE_DAYS) throw ErrInvalidRange
    const logs = await this.repo.range(new ObjectId(userID), q.from, q.to)
    return logs.map((l) => ({
      date: l.date,
      ...pick(sumMacros(l.entries)),
      entries: l.entries.length,
      waterMl: l.waterMl,
      ...(l.weightKg !== undefined ? { weightKg: l.weightKg } : {}),
      skinAm: l.skinDone.am.length,
      skinPm: l.skinDone.pm.length,
      ...burnedOf(l.workouts ?? []),
    }))
  }

  async addEntry(userID: string, date: string, req: AddEntryRequest): Promise<DaySummary> {
    const base = { id: new ObjectId(), meal: req.meal, qty: req.qty, createdAt: new Date() }
    let entry: Entry
    if ('foodId' in req) {
      const food = await this.foods.getRaw(req.foodId, userID)
      entry = { ...base, ...scaleMacros(food, req.qty), foodId: food._id, nameTh: food.nameTh, unit: food.unit }
    } else {
      entry = { ...base, ...scaleMacros(req, req.qty), nameTh: req.nameTh }
    }
    await this.repo.pushEntry(new ObjectId(userID), date, entry)
    return this.day(userID, date)
  }

  async quick(userID: string, q: QuickQuery): Promise<{ yesterday: QuickItem[]; frequent: QuickItem[] }> {
    const yesterday = addDays(q.date, -1)
    const logs = await this.repo.range(new ObjectId(userID), addDays(q.date, -FREQUENT_DAYS), yesterday)
    return { yesterday: mealOf(logs.find((l) => l.date === yesterday) ?? null, q.meal), frequent: frequentFoods(logs, q.meal) }
  }

  // ทุกรายการต้นทางต้องเป็นของผู้ใช้เอง ขาดตัวเดียว = ไม่เพิ่มเลย
  async copyEntries(userID: string, date: string, req: CopyEntriesRequest): Promise<DaySummary> {
    const uid = new ObjectId(userID)
    const dates = [...new Set(req.from.map((f) => f.date))]
    const logs = new Map((await Promise.all(dates.map((d) => this.repo.get(uid, d)))).flatMap((l) => (l ? [[l.date, l] as const] : [])))
    const now = new Date()
    const copies = req.from.map(({ date: d, entryId }) => {
      const src = logs.get(d)?.entries.find((e) => e.id.toHexString() === entryId.toLowerCase())
      if (!src) throw ErrEntryNotFound
      return { ...src, id: new ObjectId(), meal: req.meal, createdAt: now }
    })
    await this.repo.pushEntries(uid, date, copies)
    return this.day(userID, date)
  }

  async streaks(userID: string, today: string): Promise<{ streaks: Streaks; badges: Badge[] }> {
    const [facts, waterTarget] = await Promise.all([this.repo.facts([new ObjectId(userID)]), this.waterTargetOf(userID)])
    const streaks = streaksOf(facts, today, waterTarget)
    return { streaks, badges: badgesOf(streaks) }
  }

  // ให้ชาเลนจ์กลุ่มดึงตัวเลขของสมาชิกหลายคนในคำสั่งเดียว
  async factsFor(userIDs: string[], from: string, to: string): Promise<Map<string, DayFacts[]>> {
    const rows = await this.repo.facts(userIDs.map((id) => new ObjectId(id)), { from, to })
    const out = new Map<string, DayFacts[]>(userIDs.map((id) => [id, []]))
    for (const { userId, ...f } of rows) out.get(userId.toHexString())?.push(f)
    return out
  }

  async waterTargetOf(userID: string): Promise<number> {
    return (await this.targetsOrNull(userID))?.waterMl ?? DEFAULT_WATER_ML
  }

  async removeEntry(userID: string, date: string, entryID: string): Promise<DaySummary> {
    await this.repo.pullEntry(new ObjectId(userID), date, parseEntryID(entryID))
    return this.day(userID, date)
  }

  async addWorkout(userID: string, date: string, req: AddWorkoutRequest): Promise<DaySummary> {
    const { planItemId, ...activity } = req
    const log: WorkoutLog = {
      id: new ObjectId(),
      ...(planItemId ? { planItemId: new ObjectId(planItemId) } : {}),
      ...activity,
      createdAt: new Date(),
    }
    await this.repo.pushWorkout(new ObjectId(userID), date, log)
    return this.day(userID, date)
  }

  async removeWorkout(userID: string, date: string, id: string): Promise<DaySummary> {
    if (!ObjectId.isValid(id)) throw ErrWorkoutLogNotFound
    await this.repo.pullWorkout(new ObjectId(userID), date, new ObjectId(id))
    return this.day(userID, date)
  }

  async addWater(userID: string, date: string, deltaMl: number): Promise<DaySummary> {
    await this.repo.addWater(new ObjectId(userID), date, deltaMl)
    return this.day(userID, date)
  }

  // น้ำหนักของวันล่าสุดที่บันทึกไว้ คือน้ำหนักปัจจุบันในโปรไฟล์ (ใช้คำนวณงบ)
  async setWeight(userID: string, date: string, weightKg: number): Promise<DaySummary> {
    const uid = new ObjectId(userID)
    await this.repo.setWeight(uid, date, weightKg)
    const latest = await this.repo.latestWeightDate(uid)
    if (latest === date && date <= todayBangkok()) await this.profiles.setWeight(userID, weightKg)
    return this.day(userID, date)
  }

  async setSkinDone(userID: string, date: string, slot: SkinSlot, done: string[]): Promise<DaySummary> {
    await this.repo.setSkinDone(new ObjectId(userID), date, slot, [...new Set(done)])
    return this.day(userID, date)
  }

  private async targetsOrNull(userID: string): Promise<Targets | null> {
    try {
      return await this.profiles.targetsFor(userID)
    } catch (err) {
      if (err === ErrProfileNotFound) return null
      throw err
    }
  }
}

const pick = ({ kcal, proteinG }: { kcal: number; proteinG: number }) => ({ kcal, proteinG })

const burnedOf = (ws: WorkoutLog[]) => ({
  burnedKcal: ws.reduce((s, w) => s + (w.kcal ?? 0), 0),
  workoutMin: Math.round(ws.reduce((s, w) => s + w.minutes, 0)),
})

function summarize(date: string, log: DayLog | null, targets: Targets | null): DaySummary {
  const entries = log?.entries ?? []
  const workouts = log?.workouts ?? []
  const burned = burnedOf(workouts)
  const totals = sumMacros(entries)
  return {
    date,
    entries: entries.map(({ id, foodId, ...rest }) => ({ ...rest, id: id.toHexString(), ...(foodId ? { foodId: foodId.toHexString() } : {}) })),
    totals,
    byMeal: byMeal(entries),
    waterMl: log?.waterMl ?? 0,
    ...(log?.weightKg !== undefined ? { weightKg: log.weightKg } : {}),
    skinDone: log?.skinDone ?? { am: [], pm: [] },
    workouts: workouts.map(({ id, planItemId, ...rest }) => ({
      ...rest,
      id: id.toHexString(),
      ...(planItemId ? { planItemId: planItemId.toHexString() } : {}),
    })),
    burned: { kcal: burned.burnedKcal, minutes: burned.workoutMin },
    targets,
    remaining: targets ? remainingOf(targets, totals) : null,
  }
}
