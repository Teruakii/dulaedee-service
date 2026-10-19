import assert from 'node:assert/strict'
import { test } from 'node:test'
import { makeResetToken, verifyResetToken } from './reset.js'

const S = 'secret'
const U = '0123456789abcdef01234567'
const now = Date.UTC(2026, 9, 14)

test('a fresh token verifies against the same password hash', () => {
  assert.equal(verifyResetToken(S, makeResetToken(S, U, 'hash1', now), 'hash1', now), true)
})

test('the token dies once the password changes, so it works only once', () => {
  assert.equal(verifyResetToken(S, makeResetToken(S, U, 'hash1', now), 'hash2', now), false)
})

test('expires after 30 minutes', () => {
  const t = makeResetToken(S, U, 'hash1', now)
  assert.equal(verifyResetToken(S, t, 'hash1', now + 29 * 60_000), true)
  assert.equal(verifyResetToken(S, t, 'hash1', now + 31 * 60_000), false)
})

test('tampered or foreign tokens are rejected', () => {
  const t = makeResetToken(S, U, 'hash1', now)
  assert.equal(verifyResetToken('other-secret', t, 'hash1', now), false)
  assert.equal(verifyResetToken(S, t.replace(U, 'fedcba9876543210fedcba98'), 'hash1', now), false)
  assert.equal(verifyResetToken(S, 'garbage', 'hash1', now), false)
})
