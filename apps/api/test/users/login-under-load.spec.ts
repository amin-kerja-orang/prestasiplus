import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { argon2Gate } from '../../src/modules/auth/password.service'
import { ADMIN, apiOf, bootUsersApp, DEMO_PASSWORD, login, schoolIdOf, type UsersTestApp } from './helpers'

describe('login while the argon2 gate is saturated by a big import', () => {
  let t: UsersTestApp

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_IMPORT_PER_HOUR: '100000', LOGIN_IDENTIFIER_FAIL_LIMIT: '100000', THROTTLE_LOGIN_PER_MINUTE: '1000' } })
    // Listen once: supertest would otherwise start a listener per concurrent request and race.
    const server = t.app.getHttpServer() as import('node:http').Server
    await new Promise<void>((resolve) => server.listen(0, resolve))
  })
  afterAll(async () => {
    await t.close()
  })

  it('every login answers 200 or 401, never 500, and does not queue behind the import', async () => {
    const s = await schoolIdOf(t.db, 'DEMO001')
    const admin = apiOf(await login(t, ADMIN))
    const rows = Array.from({ length: 300 }, (_, i) => `Guru ${String(i)},beban${String(i)}@load.test`).join('\n')
    argon2Gate.peak = 0
    const started = Date.now()
    const importing = admin.post('/admin/users/bulk-import', { role: 'teacher', schoolId: s, importMode: 'paste', pasteContent: rows })

    const logins = Array.from({ length: 12 }, async (_, i) => {
      const good = i % 2 === 0
      const t0 = Date.now()
      const res = await t
        .http()
        .post('/api/auth/login')
        .send({ identifier: i % 4 === 0 ? 'guru@demo.test' : 'pelajar@demo.test', password: good ? DEMO_PASSWORD : 'Salah-1234' })
      return { status: res.status, ms: Date.now() - t0 }
    })
    const results = await Promise.all(logins)
    const imported = await importing
    const importMs = Date.now() - started

    expect(imported.status, JSON.stringify(imported.body).slice(0, 200)).toBe(200)
    expect(imported.body.data.created).toBe(300)
    for (const r of results) expect([200, 401]).toContain(r.status)
    expect(results.filter((r) => r.status === 200).length).toBeGreaterThan(0)
    expect(argon2Gate.peak).toBeLessThanOrEqual(2)
    // High priority: a login waits for the operations already running, not for the whole import.
    const slowest = Math.max(...results.map((r) => r.ms))
    expect(slowest, `import took ${String(importMs)} ms`).toBeLessThan(importMs)
  }, 180_000)
})

describe('an overloaded database is a retryable 429, never a 500', () => {
  it('isOverloadError recognises an expired transaction, a pool timeout and a dropped connection', async () => {
    const { isOverloadError } = await import('../../src/modules/auth/auth.errors')
    expect(isOverloadError({ code: 'P2028' })).toBe(true)
    expect(isOverloadError({ code: 'P2024' })).toBe(true)
    expect(isOverloadError(new Error('Connection terminated due to connection timeout'))).toBe(true)
    expect(isOverloadError({ message: 'x', cause: { code: 'P2028' } })).toBe(true)
    expect(isOverloadError(new Error('boom'))).toBe(false)
    expect(isOverloadError({ code: 'P2002' })).toBe(false)
    expect(isOverloadError(null)).toBe(false)
  })

  it('login answers 429 with Retry-After when the database reports an expired transaction', async () => {
    const t = await bootUsersApp()
    try {
      const { AccountRepository } = await import('../../src/modules/auth/account.repository')
      const repo = t.app.get(AccountRepository)
      const spy = vi.spyOn(repo, 'recordLogin').mockRejectedValue(Object.assign(new Error('Transaction API error: expired transaction'), { code: 'P2028' }))
      const res = await t.http().post('/api/auth/login').send({ identifier: 'guru@demo.test', password: DEMO_PASSWORD })
      expect(res.status).toBe(429)
      expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 5 })
      expect(res.headers['retry-after']).toBe('5')
      spy.mockRestore()
      expect((await t.http().post('/api/auth/login').send({ identifier: 'guru@demo.test', password: DEMO_PASSWORD })).status).toBe(200)
    } finally {
      await t.close()
    }
  })
})
