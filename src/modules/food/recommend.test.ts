import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FoodTag } from './food.model.js'
import { rankMenus } from './recommend.js'

const f = (name: string, kcal: number, proteinG: number, tags: FoodTag[]) => ({ name, kcal, proteinG, tags })

const menu = [
  f('tomyum+rice', 310, 28, ['soup']),
  f('somtam+chicken', 285, 30, ['salad']),
  f('suki', 260, 26, ['soup']),
  f('kaprao-egg', 690, 32, ['one_dish']),
  f('rice', 80, 2, ['side_dish']),
  f('steamed chicken breast', 165, 31, ['high_protein', 'no_rice']),
  f('soy milk', 160, 7, ['drink']),
  f('pad thai', 550, 20, ['one_dish']),
]

test('with a protein gap: only meals within budget, ranked by protein per kcal', () => {
  const got = rankMenus(menu, 604, 52, 3).map((m) => m.name)
  assert.deepEqual(got, ['somtam+chicken', 'suki', 'tomyum+rice'])
})

test('skips items over budget, too small, and anything that is not a meal on its own', () => {
  const got = rankMenus(menu, 604, 52, 10).map((m) => m.name)
  assert.ok(!got.includes('kaprao-egg'), 'over budget')
  assert.ok(!got.includes('rice'), 'below 25% of the remaining budget')
  assert.ok(!got.includes('steamed chicken breast'), 'a single protein, not a meal')
  assert.ok(!got.includes('soy milk'), 'drink')
})

test('no protein gap: closest to the remaining budget first', () => {
  const got = rankMenus(menu, 604, 0, 2).map((m) => m.name)
  assert.deepEqual(got, ['pad thai', 'tomyum+rice'])
})

test('nothing fits an empty budget', () => {
  assert.deepEqual(rankMenus(menu, 0, 10, 3), [])
})
