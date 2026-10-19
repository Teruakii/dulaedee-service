import type { ObjectId } from 'mongodb'
import type { Activity, Goal, Sex, Targets } from './calc.js'

export const COLLECTION = 'profiles'

export const SKIN_TYPES = ['normal', 'dry', 'oily', 'combination', 'sensitive'] as const
export type SkinType = (typeof SKIN_TYPES)[number]

export const SKIN_CONCERNS = ['acne', 'dark_spots', 'wrinkles', 'redness', 'dullness', 'large_pores'] as const
export type SkinConcern = (typeof SKIN_CONCERNS)[number]

export type Notify = { water: boolean; uv: boolean; skinRoutine: boolean }
export const DEFAULT_NOTIFY: Notify = { water: true, uv: true, skinRoutine: false }

// หนึ่งเอกสารต่อผู้ใช้ · เก็บปีเกิดแทนอายุ เพราะอายุเปลี่ยนทุกปี
export type Profile = {
  _id: ObjectId
  userId: ObjectId
  sex: Sex
  birthYear: number
  heightCm: number
  weightKg: number
  activity: Activity
  goal: Goal
  skinType?: SkinType
  skinConcerns: SkinConcern[]
  notify: Notify
  createdAt: Date
  updatedAt: Date
}

export type ProfileResponse = Omit<Profile, '_id' | 'userId'> & { id: string; age: number }

export type ProfileWithTargets = { profile: ProfileResponse; targets: Targets }
