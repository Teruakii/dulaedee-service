import { randomBytes } from 'node:crypto'
import { ObjectId, type Collection } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import type { Client } from '../../infra/db/mongodb.js'
import type { Habit } from '../daylog/streaks.js'
import { COLLECTION, MAX_MEMBERS, type Group } from './group.model.js'

export const ErrGroupNotFound = sentinel('GROUP_NOT_FOUND')
export const ErrInviteInvalid = sentinel('INVITE_INVALID')
export const ErrGroupFull = sentinel('GROUP_FULL')

// เดาไม่ได้ · ใครมีลิงก์ก็เข้ากลุ่มได้ เจ้าของจึงเปลี่ยนรหัสใหม่ได้ถ้าลิงก์หลุด
export const newInviteCode = () => randomBytes(9).toString('base64url')

export class GroupRepo {
  private readonly col: Collection<Group>

  constructor(client: Client) {
    this.col = client.db.collection<Group>(COLLECTION)
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([
      { key: { inviteCode: 1 }, name: 'uk_group_invite', unique: true },
      { key: { 'members.userId': 1 }, name: 'idx_group_member' },
    ])
  }

  async create(ownerId: ObjectId, name: string, challenge: Habit): Promise<Group> {
    const now = new Date()
    const g: Group = { _id: new ObjectId(), name, ownerId, challenge, inviteCode: newInviteCode(), members: [{ userId: ownerId, joinedAt: now }], createdAt: now, updatedAt: now }
    await this.col.insertOne(g)
    return g
  }

  listFor(userId: ObjectId): Promise<Group[]> {
    return this.col.find({ 'members.userId': userId }).sort({ createdAt: 1 }).toArray()
  }

  countFor(userId: ObjectId): Promise<number> {
    return this.col.countDocuments({ 'members.userId': userId })
  }

  // คนนอกกลุ่มได้ GROUP_NOT_FOUND เหมือนไม่มีกลุ่มนี้
  async getForMember(id: ObjectId, userId: ObjectId): Promise<Group> {
    const g = await this.col.findOne({ _id: id, 'members.userId': userId })
    if (!g) throw ErrGroupNotFound
    return g
  }

  async getByCode(code: string): Promise<Group> {
    const g = await this.col.findOne({ inviteCode: code })
    if (!g) throw ErrInviteInvalid
    return g
  }

  async update(id: ObjectId, set: Partial<Pick<Group, 'name' | 'challenge' | 'inviteCode'>>): Promise<void> {
    await this.col.updateOne({ _id: id }, { $set: { ...set, updatedAt: new Date() } })
  }

  // เช็กที่ว่างกับเป็นสมาชิกอยู่แล้วในคำสั่งเดียว กดเข้าพร้อมกันก็ไม่เกิน MAX_MEMBERS
  async join(code: string, userId: ObjectId): Promise<Group> {
    const g = await this.col.findOneAndUpdate(
      { inviteCode: code, 'members.userId': { $ne: userId }, [`members.${MAX_MEMBERS - 1}`]: { $exists: false } },
      { $push: { members: { userId, joinedAt: new Date() } }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' },
    )
    if (g) return g
    const existing = await this.getByCode(code)
    if (existing.members.some((m) => m.userId.equals(userId))) return existing
    throw ErrGroupFull
  }

  async removeMember(id: ObjectId, userId: ObjectId): Promise<void> {
    await this.col.updateOne({ _id: id }, { $pull: { members: { userId } }, $set: { updatedAt: new Date() } })
  }

  async delete(id: ObjectId): Promise<void> {
    await this.col.deleteOne({ _id: id })
  }
}
