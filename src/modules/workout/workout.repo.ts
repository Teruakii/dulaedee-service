import type { Collection, ObjectId } from 'mongodb'
import { ObjectId as OID } from 'mongodb'
import type { Client } from '../../infra/db/mongodb.js'
import { PLANS_COLLECTION, WEEKDAY_COUNT, type PlanItem, type WorkoutPlan } from './workout.model.js'

export class PlanRepo {
  private readonly col: Collection<WorkoutPlan>

  constructor(client: Client) {
    this.col = client.db.collection<WorkoutPlan>(PLANS_COLLECTION)
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([{ key: { userId: 1 }, name: 'uk_plan_user', unique: true }])
  }

  // ยังไม่เคยกรอก = ตารางว่าง 7 วัน
  async days(userId: ObjectId): Promise<PlanItem[][]> {
    return (await this.col.findOne({ userId }))?.days ?? emptyWeek()
  }

  // สร้างตารางว่างครั้งแรกแล้วแทนเฉพาะวันนั้น · ส่งซ้ำได้ผลเท่าเดิม
  async setDay(userId: ObjectId, weekday: number, items: PlanItem[]): Promise<PlanItem[][]> {
    const now = new Date()
    await this.col.updateOne(
      { userId },
      { $setOnInsert: { _id: new OID(), userId, days: emptyWeek(), createdAt: now } },
      { upsert: true },
    )
    const p = await this.col.findOneAndUpdate({ userId }, { $set: { [`days.${weekday}`]: items, updatedAt: now } }, { returnDocument: 'after' })
    return p!.days
  }
}

const emptyWeek = (): PlanItem[][] => Array.from({ length: WEEKDAY_COUNT }, () => [])
