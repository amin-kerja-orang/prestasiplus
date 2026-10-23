import { ApiError } from '../../src/common/errors/api-error'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  AUDIT_ACTIONS,
  AuditService,
  hashIp,
  REDACTED,
  sanitizeDetails,
} from '../../src/common/audit'
import { PrismaService } from '../../src/db/prisma.service'
import { createTestDatabase, type TestDatabase } from '../support/db'

const SECRET = 'test-secret-0123456789abcdef'

interface AuditRow {
  action: string
  actor_user_id: string | null
  actor_role: string | null
  scope_level: string | null
  scope_school_id: string | null
  target_type: string | null
  target_id: string | null
  request_id: string | null
  detail: Record<string, unknown> | null
  ip_hash: string | null
  is_test: boolean
}

const SELECT = `select action, actor_user_id::text, actor_role, scope_level, scope_school_id::text, target_type,
  target_id, request_id, detail, ip_hash, is_test from audit_events order by id desc limit 1`

describe('AuditService', () => {
  let db: TestDatabase
  let audit: AuditService
  let prisma: PrismaService
  let userId: string
  let schoolId: string

  beforeAll(async () => {
    db = await createTestDatabase()
    schoolId = (
      await db.query<{ id: string }>(`insert into schools (name, code) values ('SMK Audit', 'AUD001') returning id::text`)
    )[0]!.id
    userId = (
      await db.query<{ id: string }>(`insert into users (name) values ('Pengguna Audit') returning id::text`)
    )[0]!.id
    // PrismaService only needs a ConfigService-like object for DATABASE_URL.
    prisma = new PrismaService({ get: () => db.url } as never)
    audit = new AuditService(prisma, { get: () => SECRET } as never)
  })
  afterAll(async () => {
    await prisma.$disconnect()
    await db.drop()
  })

  it('exports the six BE-03 action names (the registry is append-only: later cards add their own lines)', () => {
    expect(AUDIT_ACTIONS).toMatchObject({
      LOGIN_FAILED: 'auth.login.failed',
      LOGIN_SUCCEEDED: 'auth.login.succeeded',
      LOGOUT: 'auth.logout',
      ROLE_SWITCHED: 'session.role.switched',
      MODE_ENTERED: 'session.mode.entered',
      MODE_EXITED: 'session.mode.exited',
    })
  })

  it('writes one row with the right columns', async () => {
    await audit.record({
      action: AUDIT_ACTIONS.ROLE_SWITCHED,
      actorUserId: userId,
      actorRole: 'school_admin',
      sessionRowId: '00000000-0000-4000-8000-0000000000aa',
      targetType: 'session',
      targetId: '00000000-0000-4000-8000-0000000000aa',
      schoolId,
      scopeLevel: 'school',
      requestId: 'req-1',
      details: { from: 'teacher', to: 'school_admin' },
      ip: '203.0.113.9',
    })
    const [row] = await db.query<AuditRow>(SELECT)
    expect(row).toMatchObject({
      action: 'session.role.switched',
      actor_user_id: userId,
      actor_role: 'school_admin',
      scope_level: 'school',
      scope_school_id: schoolId,
      target_type: 'session',
      target_id: '00000000-0000-4000-8000-0000000000aa',
      request_id: 'req-1',
      is_test: false,
    })
    expect(row!.detail).toEqual({
      from: 'teacher',
      to: 'school_admin',
      sessionRowId: '00000000-0000-4000-8000-0000000000aa',
    })
    expect(row!.ip_hash).toBe(hashIp('203.0.113.9', SECRET))
  })

  it('stores only a hash of the IP, never the raw address', async () => {
    await audit.record({ action: AUDIT_ACTIONS.LOGIN_FAILED, actorUserId: null, ip: '198.51.100.23' })
    const [row] = await db.query<AuditRow>(SELECT)
    expect(row!.actor_user_id).toBeNull()
    expect(row!.ip_hash).toMatch(/^[0-9a-f]{64}$/)
    const all = JSON.stringify(await db.query(`select * from audit_events`))
    expect(all).not.toContain('198.51.100.23')
    expect(all).not.toContain('203.0.113.9')
  })

  it('redacts secret-looking keys and IC-shaped values from details', async () => {
    const secret = 'S3cret-Value-Not-To-Store'
    await audit.record({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      actorUserId: null,
      details: {
        reason: 'bad_password',
        password: secret,
        nested: { sessionCookie: secret, csrfToken: secret, ok: 1 },
        icNumber: '900101015555',
        note: '900101-01-5555',
        list: [{ authorization: secret }, 'ic 010203040506 end'],
      },
    })
    const [row] = await db.query<AuditRow>(SELECT)
    const text = JSON.stringify(row)
    expect(text).not.toContain(secret)
    expect(text).not.toContain('900101')
    expect(text).not.toContain('010203040506')
    expect(row!.detail).toMatchObject({
      reason: 'bad_password',
      password: REDACTED,
      nested: { sessionCookie: REDACTED, csrfToken: REDACTED, ok: 1 },
      icNumber: REDACTED,
      note: REDACTED,
    })
  })

  it('rejects a non-decimal user id instead of writing a bad row', async () => {
    await expect(
      audit.record({ action: AUDIT_ACTIONS.LOGOUT, actorUserId: 'abc' }),
    ).rejects.toThrow(/actorUserId/)
  })

  it('the IP hash depends on the secret', () => {
    expect(hashIp('203.0.113.9', SECRET)).toBe(hashIp('203.0.113.9', SECRET))
    expect(hashIp('203.0.113.9', SECRET)).not.toBe(hashIp('203.0.113.9', SECRET + 'x'))
    expect(hashIp('203.0.113.9', SECRET)).not.toBe(hashIp('203.0.113.10', SECRET))
  })

  it('writes isTest, omits details and keeps ip_hash null when ip is null', async () => {
    await audit.record({ action: AUDIT_ACTIONS.MODE_ENTERED, actorUserId: userId, isTest: true, ip: null })
    const [row] = await db.query<AuditRow>(SELECT)
    expect(row).toMatchObject({ is_test: true, ip_hash: null, detail: null })
  })

  it('joins a caller transaction: a rollback removes the audit row', async () => {
    const before = (await db.query<{ n: string }>('select count(*)::text n from audit_events'))[0]!.n
    await prisma
      .transaction(async (tx) => {
        await audit.record({ action: AUDIT_ACTIONS.LOGOUT, actorUserId: userId, tx })
        throw new Error('rollback')
      })
      .catch(() => undefined)
    const after = (await db.query<{ n: string }>('select count(*)::text n from audit_events'))[0]!.n
    expect(after).toBe(before)
    await prisma.transaction(async (tx) => {
      await audit.record({ action: AUDIT_ACTIONS.LOGOUT, actorUserId: userId, tx })
    })
    expect((await db.query<{ n: string }>('select count(*)::text n from audit_events'))[0]!.n).toBe(String(Number(before) + 1))
  })

  it('a bad id throws a typed ApiError', async () => {
    await expect(audit.record({ action: 'x', actorUserId: '1;drop' })).rejects.toBeInstanceOf(ApiError)
  })

  it('redaction catches new keys and free-text IC numbers, and spares look-alike keys', () => {
    const out = sanitizeDetails({
      pwd: 'a', kata_laluan: 'b', otp: '123456', jwt: 'x', sid: 'y', apiKey: 'z', api_key: 'z', access_token: 't',
      msg: 'user 900101-01-5555 and 900101 01 5555 and 900101015555 tried',
      count: 900101015555,
      passed: 'ok', bypass: 'ok', topic_no: '7', logic_hash: 'abc', schoolId: '123456789012', status: 'passed',
      big: 12n, at: new Date('2026-10-19T00:00:00.000Z'),
    }) as Record<string, unknown>
    for (const k of ['pwd', 'kata_laluan', 'otp', 'jwt', 'sid', 'apiKey', 'api_key', 'access_token']) {
      expect(out[k]).toBe(REDACTED)
    }
    expect(out.msg).toBe(`user ${REDACTED} and ${REDACTED} and ${REDACTED} tried`)
    expect(out.count).toBe(REDACTED)
    expect(out).toMatchObject({
      passed: 'ok', bypass: 'ok', topic_no: '7', logic_hash: 'abc',
      schoolId: '123456789012', // a bare 12-digit whole value is treated as an id
      status: 'passed', big: '12', at: '2026-10-19T00:00:00.000Z',
    })
  })

  it('sanitises targetId, requestId and actorRole', async () => {
    await audit.record({
      action: 'x.y', actorUserId: null, actorRole: 'role 900101-01-5555',
      targetId: '990101015555', requestId: 'r 900101 01 5555',
    })
    const [row] = await db.query<AuditRow>(SELECT)
    expect(row!.target_id).toBe('990101015555') // pure id field: kept, not redacted
    expect(JSON.stringify(row)).not.toContain('900101')
  })

  it('targetId must be a decimal id or a uuid', async () => {
    await expect(audit.record({ action: 'x', actorUserId: null, targetId: '900101-01-5555' })).rejects.toBeInstanceOf(ApiError)
    await expect(audit.record({ action: 'x', actorUserId: null, targetId: 'not an id' })).rejects.toBeInstanceOf(ApiError)
  })

  it('redacts a bare 12-digit value under IC-like keys, whatever the casing', () => {
    const ic = '990101015555'
    const out = sanitizeDetails({
      ICNumber: ic, NRIC: ic, icNo: ic, noKP: ic, no_kp: ic, ic_number: ic, MyKad: ic, icnumber: ic,
      schoolId: ic, targetId: ic, topic: ic,
    }) as Record<string, unknown>
    for (const k of ['ICNumber', 'NRIC', 'icNo', 'noKP', 'no_kp', 'ic_number', 'MyKad', 'icnumber']) {
      expect(out[k], k).toBe(REDACTED)
    }
    expect(out).toMatchObject({ schoolId: ic, targetId: ic, topic: ic })
  })

  it('sanitizeDetails leaves plain facts untouched', () => {
    expect(sanitizeDetails({ from: 'teacher', count: 3, flag: true, none: null })).toEqual({
      from: 'teacher',
      count: 3,
      flag: true,
      none: null,
    })
  })
})
