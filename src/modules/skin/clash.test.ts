import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findClashes, findSlotWarnings } from './clash.js'

const cleanser = { id: 'cleanser', actives: [] }
const ahaToner = { id: 'toner', actives: ['aha' as const] }
const retinolSerum = { id: 'serum', actives: ['retinol' as const] }
const moisturizer = { id: 'moist', actives: ['niacinamide' as const, 'hyaluronic_acid' as const] }

test('mockup night routine: AHA toner clashes with retinol serum, once', () => {
  assert.deepEqual(findClashes([cleanser, ahaToner, retinolSerum, moisturizer]), [
    { productIds: ['toner', 'serum'], actives: ['aha', 'retinol'], kind: 'IRRITATION' },
  ])
})

test('one product carrying both actives does not clash with itself', () => {
  assert.deepEqual(findClashes([{ id: 'combo', actives: ['aha', 'bha'] }]), [])
})

test('no clashes in a gentle routine', () => {
  assert.deepEqual(findClashes([cleanser, moisturizer]), [])
})

test('retinol in the morning is flagged, at night it is not', () => {
  assert.deepEqual(findSlotWarnings([retinolSerum], 'am'), [{ productId: 'serum', active: 'retinol', code: 'RETINOL_AT_NIGHT' }])
  assert.deepEqual(findSlotWarnings([retinolSerum], 'pm'), [])
})
