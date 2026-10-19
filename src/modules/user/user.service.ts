import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import type { Logger } from '../../infra/logs.js'
import type { CreateUserRequest, ListUsersQuery, UpdateUserRequest } from './user.dto.js'
import type { UserResponse } from './user.model.js'
import { sentinel } from '../../constants/errors.js'
import { ErrUsernameExists, type UserRepo } from './user.repo.js'

export const SEED_ADMIN_USERNAME = 'admin'
// ลบตัวเองได้ ถ้าเป็น admin คนเดียวจะไม่มีใครเข้าหน้าจัดการได้อีก · ลบบัญชีตัวเองใช้ DELETE /account
export const ErrCannotDeleteSelf = sentinel('CANNOT_DELETE_SELF')

export class UserService {
  constructor(
    private readonly logger: Logger,
    private readonly repo: UserRepo,
    // ลบข้อมูลสุขภาพ รูป และเมนูของผู้ใช้ไปพร้อมบัญชี ไม่ให้ข้อมูลส่วนตัวค้างในระบบ
    private readonly deleteAccount: (userID: string) => Promise<void>,
  ) {}

  async create(req: CreateUserRequest): Promise<UserResponse> {
    const passwordHash = await bcrypt.hash(req.password, 10)
    return this.repo.create({ ...req, passwordHash, emailVerified: true })
  }

  getById(id: string) {
    return this.repo.getById(id)
  }

  list(q: ListUsersQuery) {
    return this.repo.list(q)
  }

  update(id: string, req: UpdateUserRequest) {
    return this.repo.update(id, req)
  }

  async delete(actorID: string, id: string) {
    const u = await this.repo.getById(id)
    if (u.id === actorID) throw ErrCannotDeleteSelf
    await this.deleteAccount(u.id)
  }

  // สร้าง ADMIN คนแรกเมื่อฐานข้อมูลว่าง · รันซ้ำได้ (ข้ามเมื่อมีผู้ใช้แล้ว)
  // ไม่มี SEED_ADMIN_PASSWORD = สุ่มรหัสแล้วพิมพ์ลง log ครั้งเดียว แทนรหัสตายตัวแบบ reference
  async ensureSeedDefaultAdmin(password: string): Promise<void> {
    if ((await this.repo.countUsers()) > 0) return
    const pass = password || randomBytes(12).toString('base64url')
    try {
      await this.create({ username: SEED_ADMIN_USERNAME, password: pass, role: 'ADMIN', firstName: 'ผู้ดูแล', lastName: 'ระบบ' })
    } catch (err) {
      if (err === ErrUsernameExists) return
      throw err
    }
    this.logger.info('SEED_DEFAULT_ADMIN_CREATED', {
      username: SEED_ADMIN_USERNAME,
      ...(password ? {} : { generatedPassword: pass }),
    })
  }
}
