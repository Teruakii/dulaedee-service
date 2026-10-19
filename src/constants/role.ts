export const ROLES = ['ADMIN', 'STAFF', 'MEMBER'] as const

// ADMIN ผู้ดูแลระบบ · STAFF ทีมโภชนาการ ดูแลเมนูและคลิป · MEMBER ผู้ใช้แอป
export type Role = (typeof ROLES)[number]

export const isRole = (r: string): r is Role => (ROLES as readonly string[]).includes(r)
