import { ObjectId, type Collection, type Filter } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import type { Client } from '../../infra/db/mongodb.js'
import { sliceHasMore } from '../../infra/http/pagination.js'
import type { CreateMyFoodRequest, ListFoodsQuery, UpsertFoodRequest } from './food.dto.js'
import { COLLECTION, type Food } from './food.model.js'

export const ErrFoodNotFound = sentinel('FOOD_NOT_FOUND')
export const ErrInvalidFoodID = sentinel('INVALID_FOOD_ID')

export function parseFoodID(id: string): ObjectId {
  if (!ObjectId.isValid(id.trim())) throw ErrInvalidFoodID
  return new ObjectId(id.trim())
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const SHARED: Filter<Food> = { ownerId: { $exists: false } }
// เมนูกลางรวมกับเมนูของผู้ใช้คนนี้
const visibleTo = (viewer: ObjectId): Filter<Food> => ({ $or: [SHARED, { ownerId: viewer }] })

export class FoodRepo {
  private readonly col: Collection<Food>

  constructor(client: Client) {
    this.col = client.db.collection<Food>(COLLECTION)
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([
      { key: { nameTh: 1 }, name: 'idx_food_name' },
      { key: { tags: 1 }, name: 'idx_food_tags' },
      { key: { kcal: 1 }, name: 'idx_food_kcal' },
      { key: { ownerId: 1 }, name: 'idx_food_owner', sparse: true },
    ])
  }

  // ใส่เมนูเริ่มต้นเฉพาะตอน collection ว่าง · restart กี่ครั้งก็ไม่ซ้ำ
  async seedIfEmpty(items: UpsertFoodRequest[]): Promise<number> {
    if ((await this.col.estimatedDocumentCount()) > 0) return 0
    const now = new Date()
    await this.col.insertMany(items.map((it) => ({ ...it, _id: new ObjectId(), createdAt: now, updatedAt: now })))
    return items.length
  }

  // $text ของ Mongo ตัดคำไทยไม่ได้ จึงค้นแบบ substring
  async list(q: ListFoodsQuery, viewer: ObjectId): Promise<{ rows: Food[]; hasMore: boolean }> {
    const filter: Filter<Food> = q.mine ? { ownerId: viewer } : visibleTo(viewer)
    if (q.q) filter.nameTh = { $regex: escapeRegex(q.q), $options: 'i' }
    if (q.tag) filter.tags = q.tag
    const docs = await this.col
      .find(filter)
      // เรียงจากมากไปน้อย เมนูที่มี ownerId จึงขึ้นก่อนเมนูกลางที่ไม่มีฟิลด์นี้
      .sort({ ownerId: -1, nameTh: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit + 1)
      .toArray()
    return sliceHasMore(docs, q.limit)
  }

  inKcalRange(min: number, max: number, viewer: ObjectId): Promise<Food[]> {
    return this.col.find({ ...visibleTo(viewer), kcal: { $gte: min, $lte: max } }).toArray()
  }

  // ชื่อ id และหมวดของทุกเมนู ใช้ผูกคลิปตั้งต้น
  names(): Promise<Pick<Food, '_id' | 'nameTh' | 'tags'>[]> {
    return this.col.find(SHARED, { projection: { nameTh: 1, tags: 1 } }).toArray()
  }

  async get(id: ObjectId): Promise<Food> {
    const f = await this.col.findOne({ _id: id })
    if (!f) throw ErrFoodNotFound
    return f
  }

  async getVisible(id: ObjectId, viewer: ObjectId): Promise<Food> {
    const f = await this.col.findOne({ _id: id, ...visibleTo(viewer) })
    if (!f) throw ErrFoodNotFound
    return f
  }

  getMany(ids: ObjectId[]): Promise<Food[]> {
    return this.col.find({ _id: { $in: ids } }).toArray()
  }

  async insert(req: UpsertFoodRequest): Promise<Food> {
    const now = new Date()
    const f: Food = { ...req, _id: new ObjectId(), createdAt: now, updatedAt: now }
    await this.col.insertOne(f)
    return f
  }

  async insertOwned(req: CreateMyFoodRequest, ownerId: ObjectId): Promise<Food> {
    const now = new Date()
    const f: Food = { ...req, verified: false, ownerId, _id: new ObjectId(), createdAt: now, updatedAt: now }
    await this.col.insertOne(f)
    return f
  }

  // staff/admin แก้ได้เฉพาะเมนูกลาง เมนูของสมาชิกเป็นข้อมูลส่วนตัว ตอบเหมือนไม่พบ
  async update(id: ObjectId, req: UpsertFoodRequest): Promise<Food> {
    const f = await this.col.findOneAndUpdate({ _id: id, ...SHARED }, { $set: { ...req, updatedAt: new Date() } }, { returnDocument: 'after' })
    if (!f) throw ErrFoodNotFound
    return f
  }

  async delete(id: ObjectId): Promise<void> {
    const res = await this.col.deleteOne({ _id: id, ...SHARED })
    if (res.deletedCount === 0) throw ErrFoodNotFound
  }

  // ไม่ใช่เจ้าของก็ตอบเหมือนไม่มีเมนูนี้ ไม่บอกว่าเป็นของคนอื่น
  async deleteOwned(id: ObjectId, ownerId: ObjectId): Promise<void> {
    const res = await this.col.deleteOne({ _id: id, ownerId })
    if (res.deletedCount === 0) throw ErrFoodNotFound
  }
}
