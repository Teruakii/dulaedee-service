import { MongoServerError, ObjectId, type Collection, type Filter } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import type { Client } from '../../infra/db/mongodb.js'
import { sliceHasMore } from '../../infra/http/pagination.js'
import type { ListClipsQuery, UpsertClipRequest } from './clip.dto.js'
import { COLLECTION, type Clip } from './clip.model.js'

export const ErrClipNotFound = sentinel('CLIP_NOT_FOUND')
export const ErrClipDuplicate = sentinel('CLIP_ALREADY_EXISTS')

export function parseClipID(id: string): ObjectId {
  if (!ObjectId.isValid(id.trim())) throw ErrClipNotFound
  return new ObjectId(id.trim())
}

const mapWriteErr = (err: unknown) => (err instanceof MongoServerError && err.code === 11000 ? ErrClipDuplicate : err)

const toDoc = (req: UpsertClipRequest) => ({ ...req, foodIds: req.foodIds.map((f) => new ObjectId(f)) })

export class ClipRepo {
  private readonly col: Collection<Clip>

  constructor(client: Client) {
    this.col = client.db.collection<Clip>(COLLECTION)
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([
      { key: { youtubeId: 1 }, name: 'uk_clip_youtube', unique: true },
      { key: { foodIds: 1 }, name: 'idx_clip_foods' },
      { key: { tags: 1 }, name: 'idx_clip_tags' },
    ])
  }

  async list(q: ListClipsQuery): Promise<{ rows: Clip[]; hasMore: boolean }> {
    const filter: Filter<Clip> = {}
    if (q.foodId) filter.foodIds = new ObjectId(q.foodId)
    if (q.tag) filter.tags = q.tag
    const docs = await this.col
      .find(filter)
      .sort({ _id: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit + 1)
      .toArray()
    return sliceHasMore(docs, q.limit)
  }

  forFoods(foodIds: ObjectId[], limit: number): Promise<Clip[]> {
    return this.col.find({ foodIds: { $in: foodIds } }).limit(limit * 3).toArray()
  }

  latest(excludeIds: ObjectId[], limit: number): Promise<Clip[]> {
    return this.col.find({ _id: { $nin: excludeIds } }).sort({ _id: -1 }).limit(limit).toArray()
  }

  // ใส่คลิปตั้งต้นเฉพาะตอนยังไม่มีคลิปเลย · admin ลบไปแล้วจะไม่กลับมาเอง
  async seedIfEmpty(items: UpsertClipRequest[]): Promise<number> {
    if ((await this.col.estimatedDocumentCount()) > 0 || items.length === 0) return 0
    const now = new Date()
    await this.col.insertMany(items.map((it) => ({ ...toDoc(it), _id: new ObjectId(), createdAt: now, updatedAt: now })))
    return items.length
  }

  async insert(req: UpsertClipRequest): Promise<Clip> {
    const now = new Date()
    const c: Clip = { ...toDoc(req), _id: new ObjectId(), createdAt: now, updatedAt: now }
    try {
      await this.col.insertOne(c)
    } catch (err) {
      throw mapWriteErr(err)
    }
    return c
  }

  async update(id: ObjectId, req: UpsertClipRequest): Promise<Clip> {
    let c: Clip | null
    try {
      c = await this.col.findOneAndUpdate({ _id: id }, { $set: { ...toDoc(req), updatedAt: new Date() } }, { returnDocument: 'after' })
    } catch (err) {
      throw mapWriteErr(err)
    }
    if (!c) throw ErrClipNotFound
    return c
  }

  async delete(id: ObjectId): Promise<void> {
    const res = await this.col.deleteOne({ _id: id })
    if (res.deletedCount === 0) throw ErrClipNotFound
  }
}
