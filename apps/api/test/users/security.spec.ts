import { createHash, createHmac } from 'node:crypto'
import { Writable } from 'node:stream'

import { CreatedUserSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { uniqueField } from '../../src/modules/users'
import { ADMIN, apiOf, bootUsersApp, expectError, login, schoolIdOf, SCHOOL_ADMIN, teacherBody, type Api, type UsersTestApp } from './helpers'

class Lines extends Writable {
  readonly lines: string[] = []
  override _write(chunk: Buffer | string, _e: BufferEncoding, cb: (err?: Error | null) => void) {
    this.lines.push(...chunk.toString().split('\n').filter(Boolean))
    cb()
  }
}

const IC = '990101015555'
const IC_DASHED = '990101-01-5555'

describe('AC 5: the IC is stored only as a keyed HMAC and a mask', () => {
  let t: UsersTestApp
  let admin: Api
  let s1: string
  const logs = new Lines()
  const bodies: string[] = []

  beforeAll(async () => {
    t = await bootUsersApp({
      logStream: logs,
      env: { LOG_LEVEL: 'trace', IC_HASH_KEY: 'ic-key-for-tests-0123456789', THROTTLE_ADMIN_WRITE_PER_MINUTE: '1000', THROTTLE_ADMIN_READ_PER_MINUTE: '1000' },
    })
    admin = apiOf(await login(t, ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  it('accepts the IC (plain or dashed), returns the mask only, and the same IC gives the same keyed hash', async () => {
    const make = async (email: string, ic: string) => {
      const res = await admin.post('/admin/users', { roles: ['student'], name: 'Murid IC', email, schoolId: s1, grade: 6, icNumber: ic })
      bodies.push(JSON.stringify(res.body))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(CreatedUserSchema.parse(res.body.data).icMasked).toBe('xxxxxx-xx-xx55')
    }
    await make('ic1@ujian.test', IC)
    await make('ic2@ujian.test', IC_DASHED)
    const rows = await t.db.query<{ ic_hash: string; ic_masked: string }>(`select ic_hash, ic_masked from users where email like 'ic_@ujian.test' order by email`)
    expect(rows[0]?.ic_hash).toBe(rows[1]?.ic_hash)
    expect(rows[0]?.ic_masked).toBe('xxxxxx-xx-xx55')
    // A keyed HMAC, not a plain digest of the IC.
    const expected = createHmac('sha256', 'ic-key-for-tests-0123456789').update(`ic:${IC}`).digest('hex')
    expect(rows[0]?.ic_hash).toBe(expected)
    for (const plain of [createHash('sha256').update(IC).digest('hex'), createHash('sha256').update(IC_DASHED).digest('hex')]) {
      expect(rows[0]?.ic_hash).not.toBe(plain)
    }
  })

  it('an update with an IC, a rejected IC and a school_admin create all stay clear of the IC', async () => {
    const id = (await t.db.query<{ id: string }>(`select id::text from users where email = 'ic1@ujian.test'`))[0]?.id
    bodies.push(JSON.stringify((await admin.put(`/admin/users/${id}`, { roles: ['student'], name: 'Murid IC', icNumber: '010203-04-0607' })).body))
    // A malformed IC that contains digits of a real one must not be echoed.
    const bad = await admin.post('/admin/users', { roles: ['student'], name: 'X', email: 'ic3@ujian.test', schoolId: s1, grade: 6, icNumber: '990101-01-55' })
    expect(bad.status).toBe(422)
    bodies.push(JSON.stringify(bad.body))
    const sa = apiOf(await login(t, SCHOOL_ADMIN))
    const res = await sa.post('/admin/users', { roles: ['student'], name: 'Murid SA', email: 'ic4@ujian.test', grade: 6, icNumber: IC })
    bodies.push(JSON.stringify(res.body))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })

  it('log capture: no clear IC in any log line', async () => {
    expect(logs.lines.length).toBeGreaterThan(0)
    const all = logs.lines.join('\n')
    for (const needle of [IC, IC_DASHED, '010203040607', '010203-04-0607', '990101-01-55', '990101']) expect(all).not.toContain(needle)
  })

  it('no response body (success or error) carries a clear IC', () => {
    for (const b of bodies) for (const needle of [IC, IC_DASHED, '990101', '010203', '040607']) expect(b).not.toContain(needle)
  })

  it('DB dump: no clear IC in any column of any table (audit events included)', async () => {
    const tables = await t.db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    )
    expect(tables.length).toBeGreaterThan(5)
    for (const { table_name } of tables) {
      const rows = await t.db.query<{ j: string }>(`select row_to_json(x)::text j from "${table_name}" x`)
      for (const r of rows) {
        for (const needle of [IC, IC_DASHED, '010203040607', '010203-04-0607']) {
          expect(r.j, table_name).not.toContain(needle)
        }
      }
    }
  })

  it('a generated password never reaches the logs or the database in clear', async () => {
    const res = await admin.post('/admin/users', teacherBody(s1, { email: 'sandi@ujian.test' }))
    const pw = CreatedUserSchema.parse(res.body.data).generatedPassword
    expect(logs.lines.join('\n')).not.toContain(pw)
    const dump = JSON.stringify(await t.db.query(`select row_to_json(u)::text from users u where email = 'sandi@ujian.test'`))
    expect(dump).not.toContain(pw)
    const hash = (await t.db.query<{ password_hash: string }>(`select password_hash from users where email = 'sandi@ujian.test'`))[0]?.password_hash
    expect(hash?.startsWith('$argon2id$')).toBe(true)
    const audit = JSON.stringify(await t.db.query(`select detail from audit_events`))
    expect(audit).not.toContain(pw)
  })
})

describe('headers, rate limits and body limits', () => {
  let t: UsersTestApp
  let admin: Api
  let s1: string

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '5', THROTTLE_ADMIN_READ_PER_MINUTE: '8', THROTTLE_IMPORT_PER_HOUR: '2' } })
    admin = apiOf(await login(t, ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  it('writes: the 6th in a minute is 429 with retryAfter and Retry-After; it resets with the window', async () => {
    for (let i = 0; i < 5; i++) expect((await admin.post('/admin/users', teacherBody(s1))).status).toBe(201)
    const res = await admin.post('/admin/users', teacherBody(s1))
    const err = expectError(res, 'RATE_LIMITED', 'Too Many Attempts.')
    expect(err.retryAfter).toBeGreaterThanOrEqual(1)
    expect(err.retryAfter).toBeLessThanOrEqual(60)
    expect(res.headers['retry-after']).toBe(String(err.retryAfter))
    t.clock.advance(61_000)
    expect((await admin.post('/admin/users', teacherBody(s1))).status).toBe(201)
  })

  it('reads: the 9th read in a minute is 429; another user is not affected', async () => {
    t.clock.advance(61_000)
    for (let i = 0; i < 8; i++) expect((await admin.get('/admin/users/filters')).status).toBe(200)
    expectError(await admin.get('/admin/users/filters'), 'RATE_LIMITED', 'Too Many Attempts.')
    const sa = apiOf(await login(t, SCHOOL_ADMIN))
    expect((await sa.get('/admin/users/filters')).status).toBe(200)
  })

  it('imports: the 3rd in an hour is 429', async () => {
    t.clock.advance(3_600_000 + 1000)
    const imp = (n: number) => admin.post('/admin/users/bulk-import', { role: 'parent', importMode: 'paste', pasteContent: `P${n},p${n}@limit.test` })
    expect((await imp(1)).status).toBe(200)
    expect((await imp(2)).status).toBe(200)
    expectError(await imp(3), 'RATE_LIMITED', 'Too Many Attempts.')
    // Still limited after a minute; free again once the hour window has passed.
    t.clock.advance(61_000)
    expectError(await imp(4), 'RATE_LIMITED', 'Too Many Attempts.')
    t.clock.advance(3_600_000)
    expect((await imp(5)).status).toBe(200)
  })

  it('a refused request (403, CSRF, 401) is not counted against the user', async () => {
    t.clock.advance(3_600_000 + 1000)
    const who = await login(t, ADMIN)
    for (let i = 0; i < 10; i++) expect((await who.agent.post('/api/admin/users').send({})).status).toBe(403)
    expect((await apiOf(who).post('/admin/users', teacherBody(s1))).status).toBe(201)
  })

  it('every route sends Cache-Control: no-store (success and error)', async () => {
    t.clock.advance(61_000)
    const admin = apiOf(await login(t, ADMIN))
    const id = (await t.db.query<{ id: string }>(`select id::text from users where email = 'guru@demo.test'`))[0]?.id
    const checks = [
      await admin.get('/admin/users'),
      await admin.get('/admin/users/filters'),
      await admin.get(`/admin/users/${id}`),
      await admin.get('/admin/users/987654321'),
      await admin.get('/admin/teachers'),
      await admin.get(`/admin/schools/${s1}/students`),
      await admin.get('/students/search?q=abc'),
      await admin.post('/admin/users', {}),
    ]
    for (const r of checks) expect(r.headers['cache-control'], String(r.status) + ' ' + JSON.stringify(r.body).slice(0, 80)).toBe('no-store')
  })
})

describe('uniqueField maps a race past the pre-check', () => {
  it('reads the violated index from a Prisma P2002 error', () => {
    expect(uniqueField({ code: 'P2002', message: 'x', meta: { driverAdapterError: { cause: { constraint: { index: 'uq_users_email' } } } } })).toBe('email')
    expect(uniqueField({ code: 'P2002', message: 'duplicate key value violates unique constraint "uq_users_school_username"' })).toBe('username')
    expect(uniqueField({ code: 'P2002', message: 'other' })).toBeNull()
    expect(uniqueField(new Error('boom'))).toBeNull()
    expect(uniqueField(null)).toBeNull()
  })

  it('a real duplicate insert raises an error uniqueField understands', async () => {
    const t = await bootUsersApp()
    try {
      await t.db.prisma.user.create({ data: { name: 'A', email: 'dup@ujian.test' } })
      const err = await t.db.prisma.user.create({ data: { name: 'B', email: 'DUP@ujian.test' } }).catch((e: unknown) => e)
      expect(uniqueField(err)).toBe('email')
    } finally {
      await t.close()
    }
  })
})

describe('audit keeps the credential-reset marker', () => {
  it('a password reset is audited as credentialReset: true (not redacted); an unknown id is 404 first', async () => {
    const t = await bootUsersApp()
    try {
      const a = apiOf(await login(t, ADMIN))
      const s = await schoolIdOf(t.db, 'DEMO001')
      const u = CreatedUserSchema.parse((await a.post('/admin/users', teacherBody(s))).body.data)
      const res = await a.put(`/admin/users/${u.id}`, { roles: ['teacher'], name: 'Tetap', resetPassword: true })
      expect(res.status).toBe(200)
      const rows = await t.db.query<{ detail: { credentialReset?: unknown } }>(`select detail from audit_events where action = 'users.updated'`)
      expect(rows[0]?.detail.credentialReset).toBe(true)
      expectError(await a.put('/admin/users/987654321', { roles: ['teacher'], name: 'X', resetPassword: true }), 'NOT_FOUND')
    } finally {
      await t.close()
    }
  })
})

describe('body limit (configureApp, IMPORT_JSON_LIMIT)', () => {
  let t: UsersTestApp
  let who: Api
  let s1: string
  beforeAll(async () => {
    t = await bootUsersApp()
    who = apiOf(await login(t, ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  it('a 1 MB import text fits the JSON limit (the one long row fails its name rule, status 200)', async () => {
    const res = await who.post('/admin/users/bulk-import', { role: 'teacher', schoolId: s1, importMode: 'paste', pasteContent: `${'x'.repeat(1_048_000)},a@b.my` })
    expect(res.status, JSON.stringify(res.body).slice(0, 200)).toBe(200)
    expect(res.body.data.failed).toBe(1)
  })

  it('a multipart text field over the size limit is 413 too (not 400)', async () => {
    const l = await login(t, ADMIN)
    const res = await l.agent
      .post('/api/admin/users/bulk-import')
      .set('X-CSRF-Token', l.csrf)
      .field('role', 'teacher')
      .field('schoolId', s1)
      .field('importMode', 'paste')
      .field('pasteContent', `A,a@b.my\n${'x'.repeat(1_048_576)}`)
    expect(res.status).toBe(413)
    expect(res.body.error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
  })

  it('the default JSON limit stays 100kb elsewhere: a 200 KB login body is 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await t.http().post('/api/auth/login').send({ identifier: 'x'.repeat(200_000), password: 'x' })
    expect(res.status).toBe(413)
    expect(res.body.error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
    expect(res.body.error.requestId).toBeTruthy()
  })

  it('a body over the limit is 413 PAYLOAD_TOO_LARGE, never 500', async () => {
    const res = await who.post('/admin/users/bulk-import', { role: 'teacher', schoolId: s1, importMode: 'paste', pasteContent: 'x'.repeat(1_200_000) })
    expect(res.status).toBe(413)
    expect(res.body.error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' })
    expect(res.body.error.requestId).toBeTruthy()
  })
})

describe('IcService key', () => {
  const cfg = (env: Record<string, string>) => ({ get: (k: string) => env[k] }) as never
  it('production without IC_HASH_KEY throws; development falls back to the session secret', async () => {
    const { IcService } = await import('../../src/modules/users/credentials')
    expect(() => new IcService(cfg({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(20) }))).toThrow(/IC_HASH_KEY is required in production/)
    expect(() => new IcService(cfg({ NODE_ENV: 'production', IC_HASH_KEY: 'k'.repeat(20) }))).not.toThrow()
    expect(new IcService(cfg({ NODE_ENV: 'test', SESSION_SECRET: 'abc' })).hash('990101015555')).toHaveLength(64)
  })
})
