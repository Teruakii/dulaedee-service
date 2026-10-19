import type { SkinSlot } from '../daylog/daylog.model.js'
import type { Active } from './skin.model.js'

export type ClashKind = 'IRRITATION' | 'OVER_EXFOLIATION' | 'DEACTIVATES'

// คู่ส่วนผสมที่ไม่ควรอยู่ใน routine เดียวกัน · ข้อมูลทั่วไป ไม่ใช่คำแนะนำทางการแพทย์
export const CLASHES: readonly [Active, Active, ClashKind][] = [
  ['retinol', 'aha', 'IRRITATION'],
  ['retinol', 'bha', 'IRRITATION'],
  ['aha', 'bha', 'OVER_EXFOLIATION'],
  ['retinol', 'benzoyl_peroxide', 'DEACTIVATES'],
  ['vitamin_c', 'benzoyl_peroxide', 'DEACTIVATES'],
]

// ส่วนผสมที่ไม่ควรใช้ในช่วงเวลานั้น
export const SLOT_WARNINGS: readonly [Active, SkinSlot, string][] = [['retinol', 'am', 'RETINOL_AT_NIGHT']]

type Product = { id: string; actives: Active[] }

export type Clash = { productIds: [string, string]; actives: [Active, Active]; kind: ClashKind }
export type SlotWarning = { productId: string; active: Active; code: string }

export function findClashes(products: Product[]): Clash[] {
  const out: Clash[] = []
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i]!
      const b = products[j]!
      for (const [x, y, kind] of CLASHES) {
        if (a.actives.includes(x) && b.actives.includes(y)) out.push({ productIds: [a.id, b.id], actives: [x, y], kind })
        else if (a.actives.includes(y) && b.actives.includes(x)) out.push({ productIds: [a.id, b.id], actives: [y, x], kind })
      }
    }
  }
  return out
}

export function findSlotWarnings(products: Product[], slot: SkinSlot): SlotWarning[] {
  return products.flatMap((p) =>
    SLOT_WARNINGS.filter(([active, s]) => s === slot && p.actives.includes(active)).map(([active, , code]) => ({ productId: p.id, active, code })),
  )
}
