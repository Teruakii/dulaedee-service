import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bmiClassOf, computeTargets } from './calc.js'

test('mockup user: female 28y 160cm 58kg light activity, lose weight', () => {
  assert.deepEqual(computeTargets({ sex: 'female', age: 28, heightCm: 160, weightKg: 58, activity: 'light', goal: 'lose' }), {
    bmr: 1279,
    tdee: 1759,
    kcal: 1450,
    proteinG: 93,
    carbG: 180,
    fatG: 40,
    waterMl: 1900,
    bmi: 22.7,
    bmiClass: 'normal',
  })
})

test('male bmr adds +5 and gain adds 300 kcal', () => {
  const t = computeTargets({ sex: 'male', age: 30, heightCm: 175, weightKg: 70, activity: 'moderate', goal: 'gain' })
  assert.equal(t.bmr, 1649) // 700 + 1093.75 - 150 + 5
  assert.equal(t.tdee, 2556)
  assert.equal(t.kcal, 2850)
})

test('a deficit never drops the budget below BMR', () => {
  const t = computeTargets({ sex: 'female', age: 60, heightCm: 150, weightKg: 45, activity: 'sedentary', goal: 'lose' })
  assert.equal(t.bmr, 927) // 450 + 937.5 - 300 - 161
  assert.equal(t.tdee, 1112)
  assert.equal(t.kcal, 930) // 1112 - 300 = 810 ต่ำกว่า BMR จึงยกขึ้นเป็น 930
})

test('asian BMI cut-offs', () => {
  assert.equal(bmiClassOf(18.4), 'underweight')
  assert.equal(bmiClassOf(18.5), 'normal')
  assert.equal(bmiClassOf(22.9), 'normal')
  assert.equal(bmiClassOf(23), 'overweight')
  assert.equal(bmiClassOf(25), 'obese')
})
