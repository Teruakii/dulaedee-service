import { ObjectId, type Db } from 'mongodb'
import { sentinel } from '../../constants/errors.js'
import { COLLECTION as DAYLOGS } from '../daylog/daylog.model.js'
import { COLLECTION as FOODS } from '../food/food.model.js'
import { COLLECTION as GROUPS, type Group } from '../group/group.model.js'
import { COLLECTION as PROFILES } from '../profile/profile.model.js'
import { COLLECTION as PUSH_SUBS } from '../push/push.model.js'
import { PRODUCTS_COLLECTION } from '../skin/skin.model.js'
import { COLLECTION as USERS } from '../user/user.model.js'
import { PLANS_COLLECTION } from '../workout/workout.model.js'

export const ErrAccountNotFound = sentinel('ACCOUNT_NOT_FOUND')

// ทุก collection ที่มีข้อมูลของผู้ใช้ และฟิลด์ที่ผูกเจ้าของ · เพิ่ม collection ใหม่ต้องเพิ่มที่นี่ด้วย ไม่งั้นลบบัญชีไม่หมด
const OWNED = {
  profile: { col: PROFILES, by: 'userId' },
  daylogs: { col: DAYLOGS, by: 'userId' },
  skinProducts: { col: PRODUCTS_COLLECTION, by: 'userId' },
  workoutPlan: { col: PLANS_COLLECTION, by: 'userId' },
  pushSubscriptions: { col: PUSH_SUBS, by: 'userId' },
  myFoods: { col: FOODS, by: 'ownerId' },
  // กลุ่มที่เป็นเจ้าของหายทั้งกลุ่ม · กลุ่มของคนอื่นแค่เอาชื่อออก (ดูใน delete)
  ownedGroups: { col: GROUPS, by: 'ownerId' },
} as const

export class AccountService {
  constructor(private readonly db: Db) {}

  // ลบข้อมูลก่อน บัญชีทีหลัง: ถ้าพังกลางทาง ผู้ใช้ยัง login มาสั่งลบซ้ำได้ · รันซ้ำได้ผลเท่าเดิม
  async delete(userID: string): Promise<void> {
    const userId = new ObjectId(userID)
    for (const { col, by } of Object.values(OWNED)) await this.db.collection(col).deleteMany({ [by]: userId })
    await this.db.collection<Group>(GROUPS).updateMany({ 'members.userId': userId }, { $pull: { members: { userId } } })
    const res = await this.db.collection(USERS).deleteOne({ _id: userId })
    if (res.deletedCount === 0) throw ErrAccountNotFound
  }
}
