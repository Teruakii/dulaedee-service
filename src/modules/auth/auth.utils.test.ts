import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Response } from 'express'
import { setRefreshCookie } from './auth.utils.js'

// จับ option ที่ส่งให้ res.cookie แทน response จริง
const cookieOptions = (appEnv: string | undefined) => {
  const before = process.env['APP_ENV']
  if (appEnv === undefined) delete process.env['APP_ENV']
  else process.env['APP_ENV'] = appEnv
  let got: Record<string, unknown> = {}
  setRefreshCookie({ cookie: (_n: string, _v: string, o: Record<string, unknown>) => (got = o) } as unknown as Response, 't')
  if (before === undefined) delete process.env['APP_ENV']
  else process.env['APP_ENV'] = before
  return { secure: got['secure'], sameSite: got['sameSite'] }
}

test('the refresh cookie is Secure + SameSite=None unless APP_ENV says development, same as the config default', () => {
  for (const env of [undefined, '', 'production', 'Production', ' staging ']) {
    assert.deepEqual(cookieOptions(env), { secure: true, sameSite: 'none' }, `APP_ENV=${JSON.stringify(env)}`)
  }
  for (const env of ['development', 'Development']) {
    assert.deepEqual(cookieOptions(env), { secure: false, sameSite: 'lax' }, `APP_ENV=${env}`)
  }
})
