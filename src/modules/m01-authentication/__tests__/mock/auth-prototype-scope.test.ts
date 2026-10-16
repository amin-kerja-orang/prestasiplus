/**
 * Prototype scope (TRACKER D43) on `POST /api/auth/login`: only the Murid, Guru and Admin Sekolah
 * demo accounts can log in; Admin Pusat, PPD, JPN, Ibu Bapa and Penaja are refused with a clear BM
 * message. The scope is turned on for these tests (it is off in the unit-test environment).
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { CANONICAL_ACCOUNTS, DEMO_PASSWORD } from '@/mock/core-data/accounts'
import { bootMock, type MockRuntime } from '@/mock/index'
import { MSG_ROLE_OUT_OF_SCOPE, ROLE_OUT_OF_SCOPE_CODE } from '@/app/prototype-scope'

import { loginThrottle } from '../../mock'
import { MSG_ACCOUNT_INACTIVE } from '../../mock/handlers/auth'

let runtime: MockRuntime
const clock = createClock({ at: CLOCK_ANCHOR_ISO })

beforeAll(async () => {
  runtime = await bootMock({ mode: 'test', clock, latencyMs: 0, onWarn: null })
}, 120_000)

beforeEach(() => {
  vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
})

afterEach(() => {
  vi.unstubAllEnvs()
  for (const account of CANONICAL_ACCOUNTS) loginThrottle.clear(account.email)
})

afterAll(() => {
  runtime.outbox.clear()
})

async function login(email: string) {
  const res = await runtime.transport.request({
    method: 'POST',
    url: '/api/auth/login',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: { email, password: DEMO_PASSWORD, remember: false },
  })
  return res
}

describe('POST /api/auth/login with the prototype scope on', () => {
  it.each(['pelajar@demo.test', 'pelajarmaju@demo.test', 'pelajar2@demo.test'])(
    'lets the Murid account %s in',
    async (email) => {
      expect((await login(email)).status).toBe(200)
    },
  )

  it('lets the Guru and Admin Sekolah accounts in', async () => {
    expect((await login('guru@demo.test')).status).toBe(200)
    expect((await login('adminsekolah@demo.test')).status).toBe(200)
  })

  it.each([
    'admin@demo.test',
    'ppd@demo.test',
    'jpn@demo.test',
    'ibubapa@demo.test',
    'penaja@demo.test',
  ])('refuses %s with "Peranan ini tidak termasuk dalam prototaip."', async (email) => {
    const res = await login(email)
    expect(res.status).toBe(403)
    const error = (res.body as { error: { code: string; message: string } }).error
    expect(error.code).toBe(ROLE_OUT_OF_SCOPE_CODE)
    expect(error.message).toBe(MSG_ROLE_OUT_OF_SCOPE)
    expect(MSG_ROLE_OUT_OF_SCOPE).toBe('Peranan ini tidak termasuk dalam prototaip.')
  })

  it('keeps the "akaun tidak aktif" message for the inactive account', async () => {
    const res = await login('tidakaktif@demo.test')
    expect(res.status).toBe(403)
    expect((res.body as { error: { message: string } }).error.message).toBe(MSG_ACCOUNT_INACTIVE)
  })

  it('lets every account in again when the switch is off', async () => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'off')
    expect((await login('admin@demo.test')).status).toBe(200)
    expect((await login('ibubapa@demo.test')).status).toBe(200)
  })
})
