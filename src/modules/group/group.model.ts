import type { ObjectId } from 'mongodb'
import type { Habit } from '../daylog/streaks.js'

export const COLLECTION = 'groups'

// กลุ่มเล็กสำหรับเพื่อนและครอบครัว · กันกลุ่มใหญ่ที่คนแปลกหน้าเห็นชื่อกัน
export const MAX_MEMBERS = 20
export const MAX_GROUPS_PER_USER = 10

export type Member = { userId: ObjectId; joinedAt: Date }

// สมาชิกเห็นกันแค่ชื่อเล่นกับจำนวนวันที่ทำครบตาม challenge ไม่เห็นตัวเลขสุขภาพ
export type Group = {
  _id: ObjectId
  name: string
  ownerId: ObjectId
  challenge: Habit
  inviteCode: string
  members: Member[]
  createdAt: Date
  updatedAt: Date
}

export type GroupSummary = { id: string; name: string; challenge: Habit; memberCount: number; isOwner: boolean }

export type BoardRow = { userId: string; firstName: string; isMe: boolean; isOwner: boolean; days: boolean[]; count: number }

export type GroupDetail = GroupSummary & {
  inviteCode: string
  week: { from: string; to: string }
  board: BoardRow[]
}

export type InvitePreview = { name: string; challenge: Habit; memberCount: number; alreadyMember: boolean; full: boolean }

export const toSummary = (g: Group, me: string): GroupSummary => ({
  id: g._id.toHexString(),
  name: g.name,
  challenge: g.challenge,
  memberCount: g.members.length,
  isOwner: g.ownerId.toHexString() === me,
})
