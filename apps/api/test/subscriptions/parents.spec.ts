import {
  PARENT_INVITE_MESSAGES,
  PARENT_INVITE_TTL_DAYS,
  ParentInviteAcceptResultSchema,
  ParentInviteGeneratedSchema,
  ParentInvitePreviewSchema,
  ParentInviteStatusSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { maskEmail } from '../../src/modules/parents/parents.service'
import {
  ADMIN,
  STUDENT,
  apiOf,
  bootParentsApp,
  expectError,
  login,
  newParent,
  userIdOf,
  type Api,
  type UsersTestApp,
} from './parents-helpers'

const DAY_MS = 24 * 60 * 60 * 1000
const HEX64 = /^[0-9a-f]{64}$/

describe('parent invites (BE-25 part B, AC 4)', () => {
  let t: UsersTestApp
  let admin: Api
  let student: Api
  let studentId: string

  const generate = async (): Promise<string> => {
    const res = await student.post('/me/parent-invite')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return ParentInviteGeneratedSchema.parse(res.body.data).token
  }
  const preview = (token: string) => t.http().get(`/api/parent-invites/${token}`)
  const inviteRows = () => t.db.query<{ token_hash: string; used_at: string | null; accepted_by_id: string | null }>('select token_hash, used_at, accepted_by_id::text from parent_invites')

  /** Makes the live invite expire (the session of the test users must stay valid, so the clock is not moved). */
  const expire = () => t.db.query("update parent_invites set expires_at = $1", [new Date(t.clock.now().getTime() - 1000)])

  beforeAll(async () => {
    t = await bootParentsApp()
    admin = apiOf(await login(t, ADMIN))
    student = apiOf(await login(t, STUDENT))
    studentId = await userIdOf(t.db, STUDENT)
  })
  afterAll(async () => {
    await t.close()
  })

  describe('student side', () => {
    it('before any token: hasToken false, no token key, no parents; no-store', async () => {
      const res = await student.get('/me/parent-invite')
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(ParentInviteStatusSchema.parse(res.body.data)).toEqual({ hasToken: false, createdAt: null, expiresAt: null, parents: [] })
      expect(await inviteRows()).toEqual([])
    })

    it('generate: 64 hex random token, exact message, 7 day expiry, no-store; only a hash is stored', async () => {
      const res = await student.post('/me/parent-invite/generate')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const data = ParentInviteGeneratedSchema.parse(res.body.data)
      expect(data.status).toBe('Link jemputan baru telah dijana!')
      expect(data.status).toBe(PARENT_INVITE_MESSAGES.regenerated)
      expect(data.token).toMatch(HEX64)
      expect(Date.parse(data.expiresAt) - Date.parse(data.createdAt)).toBe(PARENT_INVITE_TTL_DAYS * DAY_MS)
      const rows = await inviteRows()
      expect(rows).toHaveLength(1)
      expect(rows[0]?.token_hash).not.toBe(data.token)
      expect(rows[0]?.token_hash).toMatch(HEX64)
      // The clear token is stored nowhere: not in the row, not in any audit row.
      expect(JSON.stringify(await t.db.query('select * from parent_invites'))).not.toContain(data.token)
      expect(JSON.stringify(await t.db.query('select * from audit_events'))).not.toContain(data.token)
    })

    it('two tokens differ (crypto randomness) and the hash is not a plain SHA-256 of the token', async () => {
      const a = await generate()
      const b = await generate()
      expect(a).not.toBe(b)
      const { createHash } = await import('node:crypto')
      expect((await inviteRows())[0]?.token_hash).not.toBe(createHash('sha256').update(b).digest('hex'))
    })

    it('status never returns the token; a live token shows createdAt and expiresAt', async () => {
      const res = await student.get('/me/parent-invite')
      const data = ParentInviteStatusSchema.parse(res.body.data)
      expect(data.hasToken).toBe(true)
      expect(data.createdAt).not.toBeNull()
      expect(JSON.stringify(res.body)).not.toMatch(/"token"/)
      expect((await inviteRows()).length).toBe(1) // one invite per student
    })

    it('regenerating invalidates the old token at once', async () => {
      const old = await generate()
      expect((await preview(old)).status).toBe(200)
      const fresh = await generate()
      expectError(await preview(old), 'NOT_FOUND')
      expect((await preview(fresh)).status).toBe(200)
      expect((await inviteRows()).length).toBe(1)
    })

    it('only a student may call the student routes; no session is 401; a missing CSRF token is 403', async () => {
      const parent = await newParent(t, admin, 'ibu.guard@ujian.test')
      expectError(await t.http().get('/api/me/parent-invite'), 'UNAUTHORIZED', 'Unauthenticated.')
      expectError(await t.http().post('/api/me/parent-invite'), 'UNAUTHORIZED', 'Unauthenticated.')
      expectError(await parent.api.get('/me/parent-invite'), 'FORBIDDEN')
      expectError(await parent.api.post('/me/parent-invite'), 'FORBIDDEN')
      expectError(await admin.post('/me/parent-invite'), 'FORBIDDEN')
      const who = await login(t, STUDENT)
      expectError(await who.agent.post('/api/me/parent-invite'), 'CSRF_INVALID')
    })

    it('generating is audited with ids only', async () => {
      const rows = await t.db.query<{ detail: unknown; target_id: string }>(`select detail, target_id from audit_events where action = 'parents.invite.issued'`)
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.target_id === studentId)).toBe(true)
    })
  })

  describe('public preview', () => {
    it('shows the first name and the school only; guest viewer; no-store', async () => {
      const token = await generate()
      const res = await preview(token)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(ParentInvitePreviewSchema.parse(res.body.data)).toEqual({
        valid: true,
        student: { firstName: 'Murid', schoolName: 'SMK Demo Satu' },
        viewer: 'guest',
      })
      expect(JSON.stringify(res.body)).not.toContain('Demo"') // the full name 'Murid Demo' is not exposed
      expect(Object.keys(res.body.data.student).sort()).toEqual(['firstName', 'schoolName'])
    })

    it('viewer follows the optional session: parent, other (a student), guest for a bad cookie', async () => {
      const token = await generate()
      const parent = await newParent(t, admin, 'ibu.viewer@ujian.test')
      expect((await parent.who.agent.get(`/api/parent-invites/${token}`)).body.data.viewer).toBe('parent')
      expect((await (await login(t, STUDENT)).agent.get(`/api/parent-invites/${token}`)).body.data.viewer).toBe('other')
      expect((await t.http().get(`/api/parent-invites/${token}`).set('Cookie', 'pp_session=garbage')).body.data.viewer).toBe('guest')
    })

    it('the token is matched case-insensitively (the mock rule)', async () => {
      const token = await generate()
      expect((await preview(token.toUpperCase())).status).toBe(200)
    })

    it('unknown, malformed, used, expired and inactive-student tokens are one indistinguishable 404', async () => {
      const bodies: unknown[] = []
      const refuse = async (token: string) => {
        const res = await preview(token)
        expectError(res, 'NOT_FOUND')
        bodies.push({ ...res.body, error: { ...res.body.error, requestId: undefined } })
      }
      await refuse('0'.repeat(64))
      await refuse('abc')
      await refuse('x'.repeat(199))
      expect((await preview('x'.repeat(201))).status).toBe(422) // over the 200 character path limit of the contract

      // used
      const parent = await newParent(t, admin, 'ibu.used@ujian.test')
      const used = await generate()
      expect((await parent.api.post(`/parent-invites/${used}/accept`)).status).toBe(200)
      await refuse(used)

      // expired
      const stale = await generate()
      await expire()
      await refuse(stale)
      // a fresh token issued after the clock moved is live again
      const fresh = await generate()
      expect((await preview(fresh)).status).toBe(200)

      // inactive student
      await t.db.query('update users set is_active = false where id = $1', [studentId])
      await refuse(fresh)
      await t.db.query('update users set is_active = true where id = $1', [studentId])
      expect((await preview(fresh)).status).toBe(200)

      expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1)
    })
  })

  describe('accept', () => {
    it('checks the session before the token: 401 without a session, 403 for a non-parent, 403 without CSRF', async () => {
      const token = await generate()
      expectError(await t.http().post(`/api/parent-invites/${token}/accept`), 'UNAUTHORIZED', 'Unauthenticated.')
      expectError(await student.post(`/parent-invites/${token}/accept`), 'FORBIDDEN')
      expectError(await admin.post(`/parent-invites/${token}/accept`), 'FORBIDDEN')
      const parent = await newParent(t, admin, 'ibu.csrf@ujian.test')
      expectError(await parent.who.agent.post(`/api/parent-invites/${token}/accept`), 'CSRF_INVALID')
      // a refusal before the lookup leaves the token usable, and a bad token is not told apart from a good one by role
      expectError(await student.post('/parent-invites/nope/accept'), 'FORBIDDEN')
      expect((await preview(token)).status).toBe(200)
    })

    it('links the parent to the student with the relationship, consumes the token, audits, lists the parent masked', async () => {
      const token = await generate()
      const parent = await newParent(t, admin, 'ibu.satu@ujian.test', 'Ibu Satu')
      const res = await parent.api.post(`/parent-invites/${token}/accept`, { relationship: 'Ibu' })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const data = ParentInviteAcceptResultSchema.parse(res.body.data)
      expect(data).toMatchObject({ linked: true, created: true, relationship: 'Ibu', parent: { name: 'Ibu Satu' }, student: { id: studentId, schoolName: 'SMK Demo Satu' } })

      const links = await t.db.query<{ id: string; relationship: string }>('select id::text, relationship from parent_links where parent_id = $1 and student_id = $2', [parent.id, studentId])
      expect(links).toEqual([{ id: data.linkId, relationship: 'Ibu' }])
      const invite = (await inviteRows())[0]
      expect(invite?.used_at).not.toBeNull()
      expect(invite?.accepted_by_id).toBe(parent.id)

      const audit = await t.db.query<{ target_id: string; detail: Record<string, unknown> }>(`select target_id, detail from audit_events where action = 'parents.invite.accepted' and actor_user_id = $1`, [parent.id])
      expect(audit).toHaveLength(1)
      expect(audit[0]?.target_id).toBe(data.linkId)
      expect(JSON.stringify(audit)).not.toContain(token)

      const status = ParentInviteStatusSchema.parse((await student.get('/me/parent-invite')).body.data)
      expect(status.hasToken).toBe(false) // used
      expect(status.parents.map((p) => ({ name: p.name, emailMasked: p.emailMasked, relationship: p.relationship }))).toContainEqual({
        name: 'Ibu Satu',
        emailMasked: 'i***@ujian.test',
        relationship: 'Ibu',
      })
      expect(JSON.stringify(status)).not.toContain('ibu.satu@ujian.test')
    })

    it('a replay of a used token is 404 and links nothing', async () => {
      const token = await generate()
      const parent = await newParent(t, admin, 'ibu.replay@ujian.test')
      expect((await parent.api.post(`/parent-invites/${token}/accept`)).status).toBe(200)
      const other = await newParent(t, admin, 'ibu.replay2@ujian.test')
      expectError(await other.api.post(`/parent-invites/${token}/accept`), 'NOT_FOUND')
      expect(await t.db.query('select 1 from parent_links where parent_id = $1', [other.id])).toEqual([])
    })

    it('the same pair again is idempotent: created false, the old link and relationship are kept, the token is consumed', async () => {
      const parent = await newParent(t, admin, 'ibu.dua@ujian.test')
      const first = await generate()
      const a = ParentInviteAcceptResultSchema.parse((await parent.api.post(`/parent-invites/${first}/accept`, { relationship: 'Bapa' })).body.data)
      const second = await generate()
      const b = ParentInviteAcceptResultSchema.parse((await parent.api.post(`/parent-invites/${second}/accept`, { relationship: 'Penjaga' })).body.data)
      expect(b.created).toBe(false)
      expect(b.linkId).toBe(a.linkId)
      expect(b.relationship).toBe('Bapa')
      expect(await t.db.query('select 1 from parent_links where parent_id = $1', [parent.id])).toHaveLength(1)
      expectError(await preview(second), 'NOT_FOUND')
    })

    it('a second parent needs a new token; both are linked', async () => {
      const p1 = await newParent(t, admin, 'ibu.tiga@ujian.test')
      const p2 = await newParent(t, admin, 'bapa.tiga@ujian.test')
      expect((await p1.api.post(`/parent-invites/${await generate()}/accept`)).status).toBe(200)
      expect((await p2.api.post(`/parent-invites/${await generate()}/accept`)).status).toBe(200)
      const rows = await t.db.query('select 1 from parent_links where student_id = $1 and parent_id = any($2::bigint[])', [studentId, [p1.id, p2.id]])
      expect(rows).toHaveLength(2)
    })

    it('an invalid relationship is 422 and does not consume the token', async () => {
      const token = await generate()
      const parent = await newParent(t, admin, 'ibu.empat@ujian.test')
      for (const relationship of ['   ', 'x'.repeat(51), 5]) {
        const res = await parent.api.post(`/parent-invites/${token}/accept`, { relationship })
        expect(res.status).toBe(422)
        expect(res.body.error.fields.relationship).toBeTruthy()
      }
      expect((await preview(token)).status).toBe(200)
      const ok = await parent.api.post(`/parent-invites/${token}/accept`) // no body: relationship stays null
      expect(ParentInviteAcceptResultSchema.parse(ok.body.data).relationship).toBeNull()
    })

    it('an expired token is 404 on accept', async () => {
      const token = await generate()
      await expire()
      const parent = await newParent(t, admin, 'ibu.lima@ujian.test')
      expectError(await parent.api.post(`/parent-invites/${token}/accept`), 'NOT_FOUND')
      expect(await t.db.query('select 1 from parent_links where parent_id = $1', [parent.id])).toEqual([])
    })

    it('two parents racing on one token: exactly one wins, the other gets 404', async () => {
      const token = await generate()
      const p1 = await newParent(t, admin, 'ibu.lumba1@ujian.test')
      const p2 = await newParent(t, admin, 'ibu.lumba2@ujian.test')
      const [r1, r2] = await Promise.all([p1.api.post(`/parent-invites/${token}/accept`), p2.api.post(`/parent-invites/${token}/accept`)])
      expect([r1.status, r2.status].sort()).toEqual([200, 404])
      const n = await t.db.query('select 1 from parent_links where parent_id = any($1::bigint[]) and student_id = $2', [[p1.id, p2.id], studentId])
      expect(n).toHaveLength(1)
    })
  })

  describe('helpers', () => {
    it('masks e-mails as x***@domain', () => {
      expect(maskEmail('ibu@ujian.test')).toBe('i***@ujian.test')
      expect(maskEmail(null)).toBe('-***@-')
      expect(maskEmail('tidak-emel')).toBe('-***@-')
    })
  })
})

describe('parent invite rate limits (D57a)', () => {
  let t: UsersTestApp

  beforeAll(async () => {
    t = await bootParentsApp({
      THROTTLE_PARENT_INVITE_PREVIEW_PER_MINUTE: '3',
      THROTTLE_PARENT_INVITE_ISSUE_PER_HOUR: '2',
    })
  })
  afterAll(async () => {
    await t.close()
  })

  it('the public preview is limited per address: 429 with Retry-After after the ceiling, even for unknown tokens', async () => {
    for (let i = 0; i < 3; i++) expectError(await t.http().get('/api/parent-invites/zzz'), 'NOT_FOUND')
    const res = await t.http().get('/api/parent-invites/zzz')
    expectError(res, 'RATE_LIMITED', 'Too Many Attempts.')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('issuing tokens is limited per student', async () => {
    const student = apiOf(await login(t, STUDENT))
    expect((await student.post('/me/parent-invite')).status).toBe(200)
    expect((await student.post('/me/parent-invite')).status).toBe(200)
    expectError(await student.post('/me/parent-invite'), 'RATE_LIMITED', 'Too Many Attempts.')
  })
})
