import { ObjectId } from 'mongodb'
import { ageOn, computeTargets, type Targets } from './calc.js'
import type { CalcRequest, UpdateNotifyRequest, UpsertProfileRequest } from './profile.dto.js'
import type { Profile, ProfileWithTargets } from './profile.model.js'
import type { ProfileRepo } from './profile.repo.js'

export class ProfileService {
  constructor(private readonly repo: ProfileRepo) {}

  async me(userID: string): Promise<ProfileWithTargets> {
    return withTargets(await this.repo.get(new ObjectId(userID)))
  }

  async upsert(userID: string, req: UpsertProfileRequest): Promise<ProfileWithTargets> {
    return withTargets(await this.repo.upsert(new ObjectId(userID), req))
  }

  async updateNotify(userID: string, req: UpdateNotifyRequest): Promise<ProfileWithTargets> {
    return withTargets(await this.repo.updateNotify(new ObjectId(userID), req))
  }

  calc(req: CalcRequest): Targets {
    return computeTargets(req)
  }

  // ให้ daylog ใช้: งบของวันนี้ตามข้อมูลร่างกายล่าสุด
  async targetsFor(userID: string): Promise<Targets> {
    return (await this.me(userID)).targets
  }

  setWeight(userID: string, weightKg: number): Promise<void> {
    return this.repo.setWeight(new ObjectId(userID), weightKg)
  }
}

function withTargets(p: Profile): ProfileWithTargets {
  const { _id, userId: _userId, ...rest } = p
  const age = ageOn(p.birthYear, new Date())
  return { profile: { ...rest, id: _id.toHexString(), age }, targets: computeTargets({ ...p, age }) }
}
