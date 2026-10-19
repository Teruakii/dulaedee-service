import { ObjectId, type Collection } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import type { Client } from '../../infra/db/mongodb.js'
import { COLLECTION, type DayLog, type Entry, type SkinSlot, type WorkoutLog } from './daylog.model.js'
import type { DayFacts } from './streaks.js'

export const ErrEntryNotFound = sentinel('ENTRY_NOT_FOUND')
export const ErrWorkoutLogNotFound = sentinel('WORKOUT_LOG_NOT_FOUND')

const key = (userId: ObjectId, date: string) => ({ userId, date })

// ค่าเริ่มของวันที่ยังไม่มีเอกสาร · ทุก write เป็น upsert จึงไม่ต้องสร้างวันล่วงหน้า
// _id, userId, date มาจาก filter ของ upsert เอง
function onInsert(skip: (keyof DayLog | `skinDone.${SkinSlot}`)[] = []) {
  const base: Record<string, unknown> = {
    entries: [],
    workouts: [],
    waterMl: 0,
    'skinDone.am': [],
    'skinDone.pm': [],
    createdAt: new Date(),
  }
  for (const k of skip) delete base[k]
  return base
}

export class DayLogRepo {
  private readonly col: Collection<DayLog>

  constructor(client: Client) {
    this.col = client.db.collection<DayLog>(COLLECTION)
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([{ key: { userId: 1, date: 1 }, name: 'uk_daylog_user_date', unique: true }])
  }

  get(userId: ObjectId, date: string): Promise<DayLog | null> {
    return this.col.findOne(key(userId, date))
  }

  range(userId: ObjectId, from: string, to: string): Promise<DayLog[]> {
    return this.col.find({ userId, date: { $gte: from, $lte: to } }).sort({ date: 1 }).toArray()
  }

  async pushEntry(userId: ObjectId, date: string, entry: Entry): Promise<void> {
    await this.col.updateOne(
      key(userId, date),
      { $push: { entries: entry }, $set: { updatedAt: new Date() }, $setOnInsert: onInsert(['entries']) },
      { upsert: true },
    )
  }

  async pushEntries(userId: ObjectId, date: string, entries: Entry[]): Promise<void> {
    await this.col.updateOne(
      key(userId, date),
      { $push: { entries: { $each: entries } }, $set: { updatedAt: new Date() }, $setOnInsert: onInsert(['entries']) },
      { upsert: true },
    )
  }

  // นับจำนวนอย่างเดียว ไม่ดึงรายการอาหารออกมา · ไม่ระบุช่วง = ทุกวันที่เคยบันทึก
  async facts(userIds: ObjectId[], range?: { from: string; to: string }): Promise<(DayFacts & { userId: ObjectId })[]> {
    return this.col
      .aggregate<DayFacts & { userId: ObjectId }>([
        { $match: { userId: { $in: userIds }, ...(range ? { date: { $gte: range.from, $lte: range.to } } : {}) } },
        {
          $project: {
            _id: 0,
            userId: 1,
            date: 1,
            entries: { $size: { $ifNull: ['$entries', []] } },
            waterMl: { $ifNull: ['$waterMl', 0] },
            workouts: { $size: { $ifNull: ['$workouts', []] } },
            skinSteps: { $add: [{ $size: { $ifNull: ['$skinDone.am', []] } }, { $size: { $ifNull: ['$skinDone.pm', []] } }] },
          },
        },
      ])
      .toArray()
  }

  async pullEntry(userId: ObjectId, date: string, entryId: ObjectId): Promise<void> {
    const res = await this.col.updateOne(
      { ...key(userId, date), 'entries.id': entryId },
      { $pull: { entries: { id: entryId } }, $set: { updatedAt: new Date() } },
    )
    if (res.matchedCount === 0) throw ErrEntryNotFound
  }

  async pushWorkout(userId: ObjectId, date: string, w: WorkoutLog): Promise<void> {
    await this.col.updateOne(
      key(userId, date),
      { $push: { workouts: w }, $set: { updatedAt: new Date() }, $setOnInsert: onInsert(['workouts']) },
      { upsert: true },
    )
  }

  async pullWorkout(userId: ObjectId, date: string, id: ObjectId): Promise<void> {
    const res = await this.col.updateOne({ ...key(userId, date), 'workouts.id': id }, { $pull: { workouts: { id } }, $set: { updatedAt: new Date() } })
    if (res.matchedCount === 0) throw ErrWorkoutLogNotFound
  }

  // บวกลบในคำสั่งเดียว กดเพิ่มน้ำพร้อมกันหลายเครื่องก็ไม่หาย · ไม่ให้ติดลบ
  async addWater(userId: ObjectId, date: string, deltaMl: number): Promise<void> {
    await this.col.updateOne(
      key(userId, date),
      [
        {
          $set: {
            entries: { $ifNull: ['$entries', []] },
            workouts: { $ifNull: ['$workouts', []] },
            skinDone: { $ifNull: ['$skinDone', { am: [], pm: [] }] },
            createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
            waterMl: { $max: [0, { $add: [{ $ifNull: ['$waterMl', 0] }, deltaMl] }] },
            updatedAt: '$$NOW',
          },
        },
      ],
      { upsert: true },
    )
  }

  async setWeight(userId: ObjectId, date: string, weightKg: number): Promise<void> {
    await this.col.updateOne(
      key(userId, date),
      { $set: { weightKg, updatedAt: new Date() }, $setOnInsert: onInsert() },
      { upsert: true },
    )
  }

  async latestWeightDate(userId: ObjectId): Promise<string | null> {
    const d = await this.col.findOne({ userId, weightKg: { $exists: true } }, { sort: { date: -1 }, projection: { date: 1 } })
    return d?.date ?? null
  }

  async setSkinDone(userId: ObjectId, date: string, slot: SkinSlot, done: string[]): Promise<void> {
    await this.col.updateOne(
      key(userId, date),
      { $set: { [`skinDone.${slot}`]: done, updatedAt: new Date() }, $setOnInsert: onInsert([`skinDone.${slot}`]) },
      { upsert: true },
    )
  }
}
