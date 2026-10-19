import { ObjectId, type Collection } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import type { Client } from '../../infra/db/mongodb.js'
import type { UpdateNotifyRequest, UpsertProfileRequest } from './profile.dto.js'
import { COLLECTION, DEFAULT_NOTIFY, type Profile } from './profile.model.js'

export const ErrProfileNotFound = sentinel('PROFILE_NOT_FOUND')

export class ProfileRepo {
  private readonly col: Collection<Profile>

  constructor(client: Client) {
    this.col = client.db.collection<Profile>(COLLECTION)
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([{ key: { userId: 1 }, name: 'uk_profile_user', unique: true }])
  }

  async get(userId: ObjectId): Promise<Profile> {
    const p = await this.col.findOne({ userId })
    if (!p) throw ErrProfileNotFound
    return p
  }

  // upsert ตาม userId · รันซ้ำได้ผลเท่าเดิม
  async upsert(userId: ObjectId, req: UpsertProfileRequest): Promise<Profile> {
    const now = new Date()
    const { skinType, ...rest } = req
    const p = await this.col.findOneAndUpdate(
      { userId },
      {
        $set: { ...rest, ...(skinType ? { skinType } : {}), updatedAt: now },
        ...(skinType ? {} : { $unset: { skinType: '' } }),
        $setOnInsert: { _id: new ObjectId(), userId, notify: DEFAULT_NOTIFY, createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    )
    return p!
  }

  async updateNotify(userId: ObjectId, req: UpdateNotifyRequest): Promise<Profile> {
    const set = Object.fromEntries(Object.entries(req).map(([k, v]) => [`notify.${k}`, v]))
    const p = await this.col.findOneAndUpdate({ userId }, { $set: { ...set, updatedAt: new Date() } }, { returnDocument: 'after' })
    if (!p) throw ErrProfileNotFound
    return p
  }

  async setWeight(userId: ObjectId, weightKg: number): Promise<void> {
    await this.col.updateOne({ userId }, { $set: { weightKg, updatedAt: new Date() } })
  }
}
