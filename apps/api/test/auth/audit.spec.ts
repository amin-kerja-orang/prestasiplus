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
    const prisma = new PrismaService({ get: () => db.url } as never)
    audit = new AuditService(prisma)
  })
  afterAll(async () => {
    await db.drop()
  })

  it('exports the six action names', () => {
    expect(AUDIT_ACTIONS).toEqual({
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
    expect(row!.ip_hash).toBe(hashIp('203.0.113.9'))
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
        list: [{ authorization: secret }, '010203040506'],
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

  it('sanitizeDetails leaves plain facts untouched', () => {
    expect(sanitizeDetails({ from: 'teacher', count: 3, flag: true, none: null })).toEqual({
      from: 'teacher',
      count: 3,
      flag: true,
      none: null,
    })
  })
})
