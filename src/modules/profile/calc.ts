// คำนวณงบต่อวันแบบ pure ไม่แตะฐานข้อมูล ใช้ทั้ง /profile/me และหน้าเครื่องคิดเลข

export const SEXES = ['female', 'male'] as const
export type Sex = (typeof SEXES)[number]

export const ACTIVITIES = ['sedentary', 'light', 'moderate', 'active'] as const
export type Activity = (typeof ACTIVITIES)[number]

export const GOALS = ['lose', 'maintain', 'gain'] as const
export type Goal = (typeof GOALS)[number]

export const ACTIVITY_FACTOR: Record<Activity, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 }
export const GOAL_DELTA_KCAL: Record<Goal, number> = { lose: -300, maintain: 0, gain: 300 }

export type BodyInput = { sex: Sex; age: number; heightCm: number; weightKg: number; activity: Activity; goal: Goal }

// เกณฑ์ BMI สำหรับคนเอเชีย (WHO Western Pacific)
export const BMI_CLASSES = ['underweight', 'normal', 'overweight', 'obese'] as const
export type BmiClass = (typeof BMI_CLASSES)[number]
const BMI_UPPER: [number, BmiClass][] = [
  [18.5, 'underweight'],
  [23, 'normal'],
  [25, 'overweight'],
]

export type Targets = {
  bmr: number
  tdee: number
  kcal: number
  proteinG: number
  carbG: number
  fatG: number
  waterMl: number
  bmi: number
  bmiClass: BmiClass
}

const PROTEIN_G_PER_KG = 1.6
const FAT_SHARE = 0.25
const WATER_ML_PER_KG = 33

export function bmiOf(heightCm: number, weightKg: number): number {
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10
}

export function bmiClassOf(bmi: number): BmiClass {
  return BMI_UPPER.find(([upper]) => bmi < upper)?.[1] ?? 'obese'
}

export function computeTargets(b: BodyInput): Targets {
  // Mifflin-St Jeor
  const bmr = Math.round(10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age + (b.sex === 'male' ? 5 : -161))
  const tdee = Math.round(bmr * ACTIVITY_FACTOR[b.activity])
  // ปัดลงหลักสิบ และไม่ให้ต่ำกว่า BMR แม้ตั้งเป้าลดน้ำหนัก
  const kcal = Math.max(Math.floor((tdee + GOAL_DELTA_KCAL[b.goal]) / 10) * 10, Math.ceil(bmr / 10) * 10)
  const proteinG = Math.round(b.weightKg * PROTEIN_G_PER_KG)
  const fatG = Math.round((kcal * FAT_SHARE) / 9)
  const carbG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))
  const waterMl = Math.round((b.weightKg * WATER_ML_PER_KG) / 50) * 50
  const bmi = bmiOf(b.heightCm, b.weightKg)
  return { bmr, tdee, kcal, proteinG, carbG, fatG, waterMl, bmi, bmiClass: bmiClassOf(bmi) }
}

export function ageOn(birthYear: number, today: Date): number {
  return today.getFullYear() - birthYear
}
