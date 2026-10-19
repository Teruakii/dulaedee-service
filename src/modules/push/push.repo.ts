import { ObjectId, type Collection } from 'mongodb'
import type { Client } from '../../infra/db/mongodb.js'
import { COLLECTION, type PushSub } from './push.model.js'

export class PushRepo {
  private readonly col: Collection<PushSub>

  constructor(client: Client) {
    this.col = client.db.collection<PushSub>(COLLECTION)
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([
      { key: { endpoint: 1 }, name: 'uk_push_endpoint', unique: true },
      { key: { userId: 1 }, name: 'ix_push_user' },
    ])
  }

  // เบราว์เซอร์เดิมสมัครซ้ำหรือเปลี่ยนคน login: ผูก endpoint กับผู้ใช้ล่าสุด
  async upsert(userId: ObjectId, endpoint: string, keys: PushSub['keys']): Promise<void> {
    await this.col.updateOne(
      { endpoint },
      { $set: { userId, keys }, $setOnInsert: { _id: new ObjectId(), endpoint, createdAt: new Date() } },
      { upsert: true },
    )
  }

  async remove(userId: ObjectId, endpoint: string): Promise<void> {
    await this.col.deleteOne({ userId, endpoint })
  }

  // push service ตอบว่า subscription หมดอายุ
  async removeEndpoint(endpoint: string): Promise<void> {
    await this.col.deleteOne({ endpoint })
  }

  byUser(userId: ObjectId): Promise<PushSub[]> {
    return this.col.find({ userId }).toArray()
  }

  userIds(): Promise<ObjectId[]> {
    return this.col.distinct('userId')
  }
}
