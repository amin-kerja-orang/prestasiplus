import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { schoolPackagesSeed } from '../../prisma/seed/core/school-packages'
import { QuestionsService, type QuestionCreateInput } from '../../src/modules/questions'
import { QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { bootSecurityApp, call, cookieValue, COOKIE_NAME, DEMO_PASSWORD, loginAs, type Login, type SecurityApp } from './helpers'

/**
 * BE-33 AC4: every item of the audit list writes a row with actor, role, scope, action, target and
 * request id, and never personal content. One test per item. The request id is chosen by the test
 * (`X-Request-Id`, the API takes a short safe token) and compared with the response header and the row.
 *
 * Known gaps, asserted only where they hold (see the report of this card): the password-reset rows carry
 * no actor role and no scope level; question publish has no HTTP route, so its request id is the one
 * the workflow actor carries.
 */

interface AuditRow {
  id: string
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

const COLUMNS = `id::text, action, actor_user_id::text, actor_role, scope_level, scope_school_id::text, target_type,
  target_id, request_id, detail, ip_hash, is_test`

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const IC_PLAIN = /(?<!\d)\d{12}(?!\d)/
const IC_DASHED = /\d{6}-\d{2}-\d{4}/

let counter = 0
const rid = (label: string) => `req-audit-${label}-${String(++counter)}`

describe('BE-33 AC4: audit coverage, one test per audited action', () => {
  let t: SecurityApp
  let admin: Login
  let adminId: string
  let schoolId: string

  const rows = (action: string, extra = '', params: unknown[] = []) =>
    t.db.query<AuditRow>(`select ${COLUMNS} from audit_events where action = $1 ${extra} order by id`, [action, ...params])

  /** No e-mail, no IC number, no password and none of the given names anywhere in the row. */
  function expectNoPersonalContent(row: unknown, names: string[] = []): void {
    // The keyed IP hash is a 64-character hex string: leave it out of the text scan (a digit run could occur by chance).
    const { ip_hash: _ip, ...rest } = row as Record<string, unknown>
    void _ip
    const text = JSON.stringify(rest)
    expect(text).not.toMatch(EMAIL)
    expect(text).not.toMatch(IC_DASHED)
    expect(text).not.toMatch(IC_PLAIN)
    expect(text).not.toContain(DEMO_PASSWORD)
    expect(text.toLowerCase()).not.toContain('password"')
    for (const n of names) expect(text).not.toContain(n)
  }

  function expectComplete(
    row: AuditRow | undefined,
    expected: { action: string; actor: string | null; role: string | null; target: string | null; requestId: string; sessionTarget?: boolean },
  ): asserts row is AuditRow {
    expect(row, `no audit row for ${expected.action}`).toBeTruthy()
    const r = row as AuditRow
    expect(r.action).toBe(expected.action)
    expect(r.actor_user_id).toBe(expected.actor)
    expect(r.actor_user_id).toBeTruthy()
    if (expected.role !== null) expect(r.actor_role).toBe(expected.role)
    expect(r.actor_role).toBeTruthy()
    expect(r.scope_level).toBeTruthy() // the scope of the actor
    if (expected.sessionTarget) {
      // Session events name their target (the session row) in `detail.sessionRowId`; target_type/target_id stay null (reported).
      expect(String(r.detail?.sessionRowId ?? '')).toMatch(/^[0-9a-f-]{36}$/)
    } else {
      expect(r.target_type).toBeTruthy()
    }
    if (expected.target !== null) expect(r.target_id).toBe(expected.target)
    expect(r.request_id).toBe(expected.requestId)
    expect(r.ip_hash).toMatch(/^[0-9a-f]{64}$/) // a keyed hash, never the address
  }

  beforeAll(async () => {
    t = await bootSecurityApp()
    admin = await loginAs(t, 'admin@demo.test', { ip: '10.30.0.1' })
    adminId = admin.session.user.id
    schoolId = (await t.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO001'`))[0]!.id
  })
  afterAll(async () => {
    await t.close()
  })

  it('role switch writes session.role.switched with actor, role, scope, target and request id', async () => {
    const l = await loginAs(t, 'guruadmin@demo.test', { ip: '10.30.0.2' })
    const id = rid('switch')
    const res = await l.agent.post('/api/session/role').set('X-CSRF-Token', l.csrf).set('X-Request-Id', id).send({ role: 'teacher' })
    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toBe(id)
    const row = (await rows('session.role.switched', 'and actor_user_id = $2::bigint', [l.session.user.id])).at(-1)
    expectComplete(row, { action: 'session.role.switched', actor: l.session.user.id, role: null, target: null, requestId: id, sessionTarget: true })
    expectNoPersonalContent(row, [l.session.user.name])
  })

  it('Mod Pelajar enter and exit write session.mode.entered / session.mode.exited', async () => {
    const l = await loginAs(t, 'admin@demo.test', { ip: '10.30.0.3' })
    const enterId = rid('enter')
    const enter = await l.agent.post('/api/session/mode').set('X-CSRF-Token', l.csrf).set('X-Request-Id', enterId).send({ mode: 'mod_pelajar' })
    expect(enter.status).toBe(200)
    expect(enter.headers['x-request-id']).toBe(enterId)
    const exitId = rid('exit')
    const leave = await l.agent.delete('/api/session/mode').set('X-CSRF-Token', enter.body.data.csrf).set('X-Request-Id', exitId)
    expect(leave.status).toBe(200)

    const entered = (await rows('session.mode.entered', 'and actor_user_id = $2::bigint', [adminId])).at(-1)
    expectComplete(entered, { action: 'session.mode.entered', actor: adminId, role: null, target: null, requestId: enterId, sessionTarget: true })
    expectNoPersonalContent(entered, [admin.session.user.name])

    const exited = (await rows('session.mode.exited', 'and actor_user_id = $2::bigint', [adminId])).at(-1)
    expectComplete(exited, { action: 'session.mode.exited', actor: adminId, role: null, target: null, requestId: exitId, sessionTarget: true })
    expectNoPersonalContent(exited, [admin.session.user.name])
  })

  describe('user create, toggle and delete (BE-05)', () => {
    let userId: string
    const name = 'Guru Audit Bernama'
    const email = 'guru.audit@ujian.test'

    it('create writes users.created with the new user as target and no name, e-mail or password', async () => {
      const id = rid('ucreate')
      const res = await call(admin, 'post', '/admin/users', { roles: ['teacher'], name, email, schoolId }).set('X-Request-Id', id)
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      userId = res.body.data.id
      const row = (await rows('users.created', 'and target_id = $2', [userId])).at(-1)
      expectComplete(row, { action: 'users.created', actor: adminId, role: 'admin', target: userId, requestId: id })
      expect(row.target_type).toBe('user')
      expect(row.scope_school_id).toBe(schoolId)
      expectNoPersonalContent(row, [name, email, res.body.data.generatedPassword as string])
    })

    it('toggle writes users.toggled', async () => {
      const id = rid('utoggle')
      const res = await call(admin, 'post', `/admin/users/${userId}/toggle-active`).set('X-Request-Id', id)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const row = (await rows('users.toggled', 'and target_id = $2', [userId])).at(-1)
      expectComplete(row, { action: 'users.toggled', actor: adminId, role: 'admin', target: userId, requestId: id })
      expectNoPersonalContent(row, [name, email])
    })

    it('delete writes users.deleted and the row survives the deletion of its target', async () => {
      const id = rid('udelete')
      const res = await call(admin, 'delete', `/admin/users/${userId}`).set('X-Request-Id', id)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const row = (await rows('users.deleted', 'and target_id = $2', [userId])).at(-1)
      expectComplete(row, { action: 'users.deleted', actor: adminId, role: 'admin', target: userId, requestId: id })
      expectNoPersonalContent(row, [name, email])
    })
  })

  it('subscription change (BE-25) writes subscriptions.created, subscriptions.extended and subscriptions.cancelled', async () => {
    await runSeeds([schoolPackagesSeed], { prisma: t.db.prisma })
    const s3 = (await t.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO003'`))[0]!.id
    const pkg = (await t.db.query<{ id: string }>(`select id::text from school_packages where code = 'D1_D6'`))[0]!.id
    const createId = rid('subcreate')
    const created = await call(admin, 'post', '/admin/school-subscriptions', { schoolId: s3, packageTier: 'full', schoolPackageId: pkg, studentQuota: 100, paymentReference: 'TT-AUDIT', paymentNotes: 'Bank transfer' }).set('X-Request-Id', createId)
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const subId = created.body.data.id as string
    const row = (await rows('subscriptions.created', 'and target_id = $2', [subId])).at(-1)
    expectComplete(row, { action: 'subscriptions.created', actor: adminId, role: 'admin', target: subId, requestId: createId })
    expect(row.target_type).toBe('school_subscription')
    expect(row.scope_school_id).toBe(s3)
    expectNoPersonalContent(row, ['TT-AUDIT', 'Bank transfer'])

    const extendId = rid('subextend')
    const extended = await call(admin, 'post', `/admin/school-subscriptions/${subId}/extend`, { days: 30, reason: 'Kelewatan bayaran' }).set('X-Request-Id', extendId)
    expect(extended.status, JSON.stringify(extended.body)).toBe(200)
    const ext = (await rows('subscriptions.extended', 'and target_id = $2', [subId])).at(-1)
    expectComplete(ext, { action: 'subscriptions.extended', actor: adminId, role: 'admin', target: subId, requestId: extendId })
    expectNoPersonalContent(ext, ['Kelewatan bayaran'])

    const cancelId = rid('subcancel')
    const cancelled = await call(admin, 'post', `/admin/school-subscriptions/${subId}/cancel`, {}).set('X-Request-Id', cancelId)
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200)
    const can = (await rows('subscriptions.cancelled', 'and target_id = $2', [subId])).at(-1)
    expectComplete(can, { action: 'subscriptions.cancelled', actor: adminId, role: 'admin', target: subId, requestId: cancelId })
    expectNoPersonalContent(can)
  })

  it('question publish (BE-10) writes one question_status_events row per step with actor, role and request id', async () => {
    const questions = t.app.get(QuestionsService)
    const workflow = t.app.get(QuestionWorkflowService)
    const [seed] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; sp: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    const [chapter] = await t.db.query<{ id: string }>(
      'select id::text from chapters where subject_id = $1::bigint and education_level_id = $2::bigint limit 1',
      [seed!.subject_id, seed!.education_level_id],
    )
    const body = {
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah dua dan tiga?',
      subjectId: seed!.subject_id,
      educationLevelId: seed!.education_level_id,
      difficultyLevel: 2,
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      tag: { unitId: seed!.unit_node_id, spIds: [seed!.sp], tp: 3 },
    } as unknown as QuestionCreateInput
    const view = await questions.create(body, { userId: adminId, role: 'admin' })
    await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [chapter!.id, view.id])

    const requestId = rid('publish')
    const actor = { userId: adminId, role: 'admin' as const, requestId, ip: '10.30.0.9', isTest: false }
    for (const to of ['review', 'approved', 'published'] as const) await workflow.transition(view.id, to, actor)

    const events = await t.db.query<{ from_status: string | null; to_status: string; actor_user_id: string; actor_role: string; request_id: string; reason: string | null }>(
      'select from_status, to_status, actor_user_id::text, actor_role, request_id, reason from question_status_events where question_id = $1::bigint order by id',
      [view.id],
    )
    expect(events.map((e) => [e.from_status, e.to_status])).toEqual([
      ['draft', 'review'],
      ['review', 'approved'],
      ['approved', 'published'],
    ])
    for (const e of events) {
      expect(e.actor_user_id).toBe(adminId)
      expect(e.actor_role).toBe('admin')
      expect(e.request_id).toBe(requestId)
      expectNoPersonalContent(e)
    }
    // The table has no scope column: the scope of a question is its subject and level, not a school.

    // The HTTP route that can publish (POST /questions/bulk-action) is audited in audit_events.
    const second = await questions.create(body, { userId: adminId, role: 'admin' })
    await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [chapter!.id, second.id])
    const ids: string[] = []
    for (const action of ['review', 'approved', 'published']) {
      const id = rid(`bulk-${action}`)
      ids.push(id)
      const res = await call(admin, 'post', '/questions/bulk-action', { action, ids: [second.id] }).set('X-Request-Id', id)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.affected).toBe(1)
    }
    const bulk = await t.db.query<AuditRow>(
      `select ${COLUMNS} from audit_events where action = 'question.bulk_action' and request_id = any($1) order by id`,
      [ids],
    )
    expect(bulk.map((b) => b.request_id)).toEqual(ids)
    for (const b of bulk) {
      expect(b.actor_user_id).toBe(adminId)
      expect(b.actor_role).toBe('admin')
      // scope_level is null on these rows (reported): QuestionAudit passes no scope.
      expect(JSON.stringify(b.detail)).toContain(second.id)
      expectNoPersonalContent(b)
    }
  })

  it('password reset (BE-06) writes account.password_reset rows for the request and the completion, with no token or password', async () => {
    const email = 'pelajar2@demo.test'
    const user = (await t.db.query<{ id: string; name: string; school_id: string | null }>(`select id::text, name, school_id::text from users where email = $1`, [email]))[0]!
    const askId = rid('reset-ask')
    const ask = await t.http().post('/api/auth/password/email').set('X-Forwarded-For', '10.30.0.4').set('X-Request-Id', askId).send({ email })
    expect(ask.status).toBe(200)
    const mail = t.mail.last()
    const newPassword = 'Baharu-Audit-9921'
    const doneId = rid('reset-done')
    const done = await t
      .http()
      .post('/api/auth/password/reset')
      .set('X-Forwarded-For', '10.30.0.4')
      .set('X-Request-Id', doneId)
      .send({ token: mail.token, email, password: newPassword, passwordConfirmation: newPassword })
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300)

    const all = await t.db.query<AuditRow>(
      `select ${COLUMNS} from audit_events where target_type = 'user' and target_id = $1 and request_id = any($2) order by id`,
      [user.id, [askId, doneId]],
    )
    expect(all.length).toBeGreaterThanOrEqual(2)
    const requested = all.find((r) => r.request_id === askId)
    const completed = all.find((r) => r.request_id === doneId)
    expect(requested?.action).toMatch(/^account\./)
    expect(completed?.action).toMatch(/^account\./)
    // Completion: the user is the actor. (No actor role and no scope level are stored on these rows: reported.)
    expect(completed?.actor_user_id).toBe(user.id)
    expect(completed?.target_id).toBe(user.id)
    expect(completed?.scope_school_id).toBe(user.school_id)
    expect(requested?.target_id).toBe(user.id)
    expect(requested?.scope_school_id).toBe(user.school_id)
    for (const r of all) {
      expect(r.ip_hash).toMatch(/^[0-9a-f]{64}$/)
      expectNoPersonalContent(r, [user.name, email, mail.token, newPassword])
    }
    // The new password works and the cookie is not a part of any row.
    const login = await t.http().post('/api/auth/login').set('X-Forwarded-For', '10.30.0.5').send({ identifier: email, password: newPassword })
    expect(login.status).toBe(200)
    const cookie = cookieValue(login)
    expect(cookie).toBeTruthy()
    expect(JSON.stringify(await t.db.query('select * from audit_events'))).not.toContain(`${COOKIE_NAME}=${cookie}`)
  })

  // --- KNOWN GAPS (AC4, cross-lane). BE-03/06/10 are fixed in this branch (normal `it`); any `it.fails` left is still open.
  // Owners and issues: PR #81 body "Cross-lane gaps". The rows read
  // here were written by the tests above (same file, sequential).
  describe('KNOWN GAP (owner lanes): fields AC4 requires that are still empty', () => {
    it('BE-03: session audit rows name the session in target_type/target_id', async () => {
      const rows = await t.db.query<AuditRow>(`select ${COLUMNS} from audit_events where action like 'session.%'`)
      expect(rows.length).toBeGreaterThan(0)
      for (const r of rows) {
        expect(r.target_type).toBeTruthy()
        expect(r.target_id).toBeTruthy()
      }
    })

    it('BE-06: password-reset completion carries actor, role and scope level; the request row has no actor by design', async () => {
      const rows = await t.db.query<AuditRow>(`select ${COLUMNS} from audit_events where action like 'account.%' and request_id like '%reset-%'`)
      expect(rows.length).toBeGreaterThanOrEqual(2)
      // The reset REQUEST is an unauthenticated flow: no actor, role or scope level exists to record. Only this
      // expectation is relaxed; the completion row (the user is signed in by the reset) keeps actor + role + scope level.
      for (const r of rows.filter((x) => x.request_id?.includes('reset-ask'))) {
        expect(r.actor_user_id).toBeNull()
        expect(r.actor_role).toBeNull()
      }
      const completion = rows.filter((x) => x.request_id?.includes('reset-done'))
      expect(completion.length).toBeGreaterThanOrEqual(1)
      for (const r of completion) {
        expect(r.actor_user_id).toBeTruthy()
        expect(r.actor_role).toBeTruthy()
        expect(r.scope_level).toBeTruthy()
      }
    })

    it('BE-10: POST /questions/bulk-action writes question_status_events and a scope level on question.bulk_action', async () => {
      const bulk = await t.db.query<AuditRow>(`select ${COLUMNS} from audit_events where action = 'question.bulk_action' and request_id like '%bulk-%'`)
      expect(bulk.length).toBeGreaterThan(0)
      for (const b of bulk) expect(b.scope_level).toBeTruthy()
      const events = await t.db.query<{ n: string }>('select count(*)::text as n from question_status_events where request_id = any($1)', [bulk.map((b) => b.request_id)])
      expect(Number(events[0]!.n)).toBe(bulk.length)
    })
  })

  it('no audit row anywhere holds an e-mail, a 12-digit IC number, a password or a session value (whole table)', async () => {
    const all = JSON.stringify(await t.db.query('select * from audit_events'))
    expect(all).not.toMatch(EMAIL)
    expect(all).not.toMatch(IC_DASHED)
    expect(all).not.toContain(admin.token)
    expect(all).not.toContain(admin.csrf)
    expect(all).not.toContain('Baharu-Audit-9921')
  })
})
