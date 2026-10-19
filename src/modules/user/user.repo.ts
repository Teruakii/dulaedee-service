import { MongoServerError, ObjectId, type Collection } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import type { Client } from '../../infra/db/mongodb.js'
import { sliceHasMore } from '../../infra/http/pagination.js'
import type { ListUsersQuery, NewUser, UpdateUserRequest } from './user.dto.js'
import { COLLECTION, toResponse, type User, type UserAuth, type UserResponse } from './user.model.js'

export const ErrUserNotFound = sentinel('USER_NOT_FOUND')
export const ErrUsernameExists = sentinel('USERNAME_ALREADY_EXISTS')
export const ErrEmailExists = sentinel('EMAIL_ALREADY_EXISTS')

// auth ใช้ผ่าน interface นี้ เพื่อให้ test ใส่ repo ปลอมได้
export interface UserRepo {
  countUsers(): Promise<number>
  create(u: NewUser): Promise<UserResponse>
  getById(id: string): Promise<UserResponse>
  getAuthById(id: string): Promise<UserAuth>
  getByUsername(username: string): Promise<UserAuth>
  getByEmail(email: string): Promise<UserAuth>
  list(q: ListUsersQuery): Promise<{ rows: UserResponse[]; hasMore: boolean }>
  update(id: string, req: UpdateUserRequest): Promise<UserResponse>
  updatePasswordHash(id: string, hash: string): Promise<void>
  markEmailVerified(id: string): Promise<void>
}

function parseObjectID(id: string): ObjectId {
  // id ผิดรูปแบบถือว่าไม่พบ เหมือน reference
  if (!ObjectId.isValid(id.trim())) throw ErrUserNotFound
  return new ObjectId(id.trim())
}

function mapDuplicateError(err: unknown): unknown {
  if (!(err instanceof MongoServerError) || err.code !== 11000) return err
  if (err.message.includes('uk_username')) return ErrUsernameExists
  if (err.message.includes('uk_user_email')) return ErrEmailExists
  return err
}

export class UserRepoMongo implements UserRepo {
  private readonly col: Collection<User>

  constructor(client: Client) {
    this.col = client.db.collection<User>(COLLECTION)
  }

  async ensureIndexes(): Promise<void> {
    await this.col.createIndexes([
      { key: { username: 1 }, name: 'uk_username', unique: true },
      // email ไม่บังคับ จึง unique เฉพาะเอกสารที่มี email
      { key: { email: 1 }, name: 'uk_user_email', unique: true, partialFilterExpression: { email: { $type: 'string' } } },
      { key: { role: 1 }, name: 'idx_role' },
    ])
  }

  countUsers(): Promise<number> {
    return this.col.estimatedDocumentCount()
  }

  async create(n: NewUser): Promise<UserResponse> {
    const now = new Date()
    const u: User = {
      _id: new ObjectId(),
      username: n.username,
      password: n.passwordHash,
      role: n.role,
      isActive: true,
      firstName: n.firstName,
      lastName: n.lastName,
      ...(n.email ? { email: n.email } : {}),
      ...(n.email && n.emailVerified ? { emailVerifiedAt: now } : {}),
      ...(n.termsAcceptedAt ? { termsAcceptedAt: n.termsAcceptedAt } : {}),
      ...(n.privacyAcceptedAt ? { privacyAcceptedAt: n.privacyAcceptedAt } : {}),
      createdAt: now,
      updatedAt: now,
    }
    try {
      await this.col.insertOne(u)
    } catch (err) {
      throw mapDuplicateError(err)
    }
    return toResponse(u)
  }

  async getById(id: string): Promise<UserResponse> {
    const u = await this.col.findOne({ _id: parseObjectID(id) })
    if (!u) throw ErrUserNotFound
    return toResponse(u)
  }

  // ชื่อที่สมาชิกกลุ่มเห็นกัน · เฉพาะชื่อเล่น ไม่ส่ง username หรืออีเมล
  async firstNames(ids: ObjectId[]): Promise<Map<string, string>> {
    const rows = await this.col.find({ _id: { $in: ids } }, { projection: { firstName: 1 } }).toArray()
    return new Map(rows.map((u) => [u._id.toHexString(), u.firstName]))
  }

  getAuthById(id: string): Promise<UserAuth> {
    return this.findActiveForAuth({ _id: parseObjectID(id) })
  }

  getByUsername(username: string): Promise<UserAuth> {
    return this.findActiveForAuth({ username: username.trim().toLowerCase() })
  }

  getByEmail(email: string): Promise<UserAuth> {
    return this.findActiveForAuth({ email: email.trim().toLowerCase() })
  }

  private async findActiveForAuth(by: Partial<User>): Promise<UserAuth> {
    const u = await this.col.findOne({ ...by, isActive: true })
    if (!u) throw ErrUserNotFound
    return {
      id: u._id.toHexString(),
      username: u.username,
      password: u.password,
      role: u.role,
      ...(u.email ? { email: u.email } : {}),
      emailVerified: Boolean(u.emailVerifiedAt),
    }
  }

  async list(q: ListUsersQuery): Promise<{ rows: UserResponse[]; hasMore: boolean }> {
    const docs = await this.col
      .find(q.role ? { role: q.role } : {})
      .sort({ _id: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit + 1)
      .toArray()
    const { rows, hasMore } = sliceHasMore(docs, q.limit)
    return { rows: rows.map(toResponse), hasMore }
  }

  async update(id: string, req: UpdateUserRequest): Promise<UserResponse> {
    const set: Partial<User> = { updatedAt: new Date() }
    if (req.firstName !== undefined) set.firstName = req.firstName
    if (req.lastName !== undefined) set.lastName = req.lastName
    // admin เป็นคนกรอกอีเมลให้ จึงนับว่ายืนยันแล้ว เหมือนตอน admin สร้างบัญชี
    if (req.email !== undefined) Object.assign(set, { email: req.email, emailVerifiedAt: new Date() })
    try {
      const res = await this.col.updateOne({ _id: parseObjectID(id) }, { $set: set })
      if (res.matchedCount === 0) throw ErrUserNotFound
    } catch (err) {
      throw mapDuplicateError(err)
    }
    return this.getById(id)
  }

  async markEmailVerified(id: string): Promise<void> {
    const res = await this.col.updateOne({ _id: parseObjectID(id), emailVerifiedAt: { $exists: false } }, { $set: { emailVerifiedAt: new Date(), updatedAt: new Date() } })
    if (res.matchedCount === 0 && !(await this.col.countDocuments({ _id: parseObjectID(id) }))) throw ErrUserNotFound
  }

  async updatePasswordHash(id: string, hash: string): Promise<void> {
    const res = await this.col.updateOne({ _id: parseObjectID(id) }, { $set: { password: hash, updatedAt: new Date() } })
    if (res.matchedCount === 0) throw ErrUserNotFound
  }
}
