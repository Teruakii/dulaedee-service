import { ObjectId } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import { addDays, weekStart } from '../daylog/calc.js'
import type { DayLogService } from '../daylog/daylog.service.js'
import { boardOf } from './board.js'
import type { UpsertGroupRequest } from './group.dto.js'
import { MAX_GROUPS_PER_USER, MAX_MEMBERS, toSummary, type Group, type GroupDetail, type GroupSummary, type InvitePreview } from './group.model.js'
import { ErrGroupNotFound, newInviteCode, type GroupRepo } from './group.repo.js'

export const ErrGroupLimit = sentinel('GROUP_LIMIT_REACHED')
export const ErrNotGroupOwner = sentinel('NOT_GROUP_OWNER')
// เจ้าของออกเองไม่ได้ ต้องลบกลุ่ม · กลุ่มจะได้ไม่ค้างโดยไม่มีใครดูแล
export const ErrOwnerCannotLeave = sentinel('OWNER_CANNOT_LEAVE')

type FirstNames = (ids: ObjectId[]) => Promise<Map<string, string>>

const oid = (id: string, notFound: Error) => {
  if (!ObjectId.isValid(id)) throw notFound
  return new ObjectId(id)
}

export class GroupService {
  constructor(
    private readonly repo: GroupRepo,
    private readonly days: DayLogService,
    private readonly firstNames: FirstNames,
  ) {}

  async list(me: string): Promise<GroupSummary[]> {
    return (await this.repo.listFor(new ObjectId(me))).map((g) => toSummary(g, me))
  }

  async create(me: string, req: UpsertGroupRequest): Promise<GroupSummary> {
    const uid = new ObjectId(me)
    if ((await this.repo.countFor(uid)) >= MAX_GROUPS_PER_USER) throw ErrGroupLimit
    return toSummary(await this.repo.create(uid, req.name, req.challenge), me)
  }

  async detail(me: string, id: string, today: string): Promise<GroupDetail> {
    const g = await this.member(me, id)
    const from = weekStart(today)
    const to = addDays(from, 6)
    const ids = g.members.map((m) => m.userId.toHexString())
    const [facts, names, water] = await Promise.all([
      this.days.factsFor(ids, from, to),
      this.firstNames(g.members.map((m) => m.userId)),
      // เป้าน้ำต่างกันตามน้ำหนักแต่ละคน · ใช้เฉพาะชาเลนจ์น้ำ
      g.challenge === 'water' ? Promise.all(ids.map((uid) => this.days.waterTargetOf(uid))) : Promise.resolve(ids.map(() => 0)),
    ])
    const members = ids.map((uid, i) => ({ userId: uid, firstName: names.get(uid) ?? '', facts: facts.get(uid) ?? [], waterTargetMl: water[i]! }))
    return { ...toSummary(g, me), inviteCode: g.inviteCode, week: { from, to }, board: boardOf(members, g.challenge, from, today, me, g.ownerId.toHexString()) }
  }

  // หน้าชวนเข้ากลุ่มแสดงชื่อกลุ่มก่อนกดยืนยัน
  async preview(me: string, code: string): Promise<InvitePreview> {
    const g = await this.repo.getByCode(code)
    return {
      name: g.name,
      challenge: g.challenge,
      memberCount: g.members.length,
      alreadyMember: g.members.some((m) => m.userId.toHexString() === me),
      full: g.members.length >= MAX_MEMBERS,
    }
  }

  async join(me: string, code: string): Promise<GroupSummary> {
    const uid = new ObjectId(me)
    const g = await this.repo.getByCode(code)
    if (!g.members.some((m) => m.userId.equals(uid)) && (await this.repo.countFor(uid)) >= MAX_GROUPS_PER_USER) throw ErrGroupLimit
    return toSummary(await this.repo.join(code, uid), me)
  }

  async update(me: string, id: string, req: UpsertGroupRequest): Promise<GroupSummary> {
    const g = await this.owned(me, id)
    await this.repo.update(g._id, { name: req.name, challenge: req.challenge })
    return toSummary({ ...g, ...req }, me)
  }

  // ลิงก์เดิมใช้ไม่ได้ทันที · สมาชิกที่อยู่แล้วไม่หลุด
  async rotateCode(me: string, id: string): Promise<{ inviteCode: string }> {
    const g = await this.owned(me, id)
    const inviteCode = newInviteCode()
    await this.repo.update(g._id, { inviteCode })
    return { inviteCode }
  }

  // ออกเอง หรือเจ้าของเอาคนอื่นออก
  async removeMember(me: string, id: string, target: string): Promise<void> {
    const g = await this.member(me, id)
    const isOwner = g.ownerId.toHexString() === me
    if (target === me) {
      if (isOwner) throw ErrOwnerCannotLeave
    } else {
      if (!isOwner) throw ErrNotGroupOwner
      if (!g.members.some((m) => m.userId.toHexString() === target)) throw ErrGroupNotFound
    }
    await this.repo.removeMember(g._id, new ObjectId(target))
  }

  async delete(me: string, id: string): Promise<void> {
    await this.repo.delete((await this.owned(me, id))._id)
  }

  private member(me: string, id: string): Promise<Group> {
    return this.repo.getForMember(oid(id, ErrGroupNotFound), new ObjectId(me))
  }

  private async owned(me: string, id: string): Promise<Group> {
    const g = await this.member(me, id)
    if (g.ownerId.toHexString() !== me) throw ErrNotGroupOwner
    return g
  }
}

