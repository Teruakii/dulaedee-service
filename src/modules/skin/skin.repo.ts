import { ObjectId, type AnyBulkWriteOperation, type Collection } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import type { Client } from '../../infra/db/mongodb.js'
import type { SkinSlot } from '../daylog/daylog.model.js'
import type { UpsertProductRequest } from './skin.dto.js'
import { PRODUCTS_COLLECTION, STEPS, type SkinProduct } from './skin.model.js'

export const ErrProductNotFound = sentinel('SKIN_PRODUCT_NOT_FOUND')

export function parseID(id: string, notFound: Error): ObjectId {
  if (!ObjectId.isValid(id.trim())) throw notFound
  return new ObjectId(id.trim())
}

// ลำดับเริ่มต้นตามขั้นตอน (คลีนซิ่งก่อน กันแดดท้าย) ×10 เผื่อแทรก
const defaultOrder = (step: SkinProduct['step']) => (STEPS.indexOf(step) + 1) * 10

export class SkinProductRepo {
  private readonly col: Collection<SkinProduct>

  constructor(client: Client) {
    this.col = client.db.collection<SkinProduct>(PRODUCTS_COLLECTION)
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([{ key: { userId: 1, slots: 1 }, name: 'idx_skin_product_user_slot' }])
  }

  list(userId: ObjectId): Promise<SkinProduct[]> {
    return this.col.find({ userId }).sort({ step: 1, name: 1 }).toArray()
  }

  inSlot(userId: ObjectId, slot: SkinSlot): Promise<SkinProduct[]> {
    return this.col
      .find({ userId, slots: slot })
      .sort({ [`order.${slot}`]: 1 })
      .toArray()
  }

  async insert(userId: ObjectId, req: UpsertProductRequest): Promise<SkinProduct> {
    const now = new Date()
    const order = defaultOrder(req.step)
    const p: SkinProduct = { ...req, _id: new ObjectId(), userId, order: { am: order, pm: order }, createdAt: now, updatedAt: now }
    await this.col.insertOne(p)
    return p
  }

  // filter ด้วย userId ทุกครั้ง แก้ของคนอื่นไม่ได้แม้รู้ id
  async update(userId: ObjectId, id: ObjectId, req: UpsertProductRequest): Promise<SkinProduct> {
    const p = await this.col.findOneAndUpdate({ _id: id, userId }, { $set: { ...req, updatedAt: new Date() } }, { returnDocument: 'after' })
    if (!p) throw ErrProductNotFound
    return p
  }

  async delete(userId: ObjectId, id: ObjectId): Promise<void> {
    const res = await this.col.deleteOne({ _id: id, userId })
    if (res.deletedCount === 0) throw ErrProductNotFound
  }

  async reorder(userId: ObjectId, slot: SkinSlot, ids: ObjectId[]): Promise<void> {
    const ops: AnyBulkWriteOperation<SkinProduct>[] = ids.map((_id, i) => ({
      updateOne: { filter: { _id, userId, slots: slot }, update: { $set: { [`order.${slot}`]: (i + 1) * 10, updatedAt: new Date() } } },
    }))
    const res = await this.col.bulkWrite(ops, { ordered: false })
    if (res.matchedCount !== ids.length) throw ErrProductNotFound
  }
}
