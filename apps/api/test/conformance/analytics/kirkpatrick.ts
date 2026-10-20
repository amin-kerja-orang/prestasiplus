import type { ActorRole, HttpClient, Scenario, ScenarioContext } from '@pp/contract-tests'

import { dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Kirkpatrick, feedback and interventions (BE-20, M12): the 14 routes, the guards, the scope rules of the
 * contract (teacher and school_admin forced to the own school), the monthly feedback and the intervention round
 * trip. Every 200 body is also checked against the contract schema by the runner. The figure checks (totals,
 * bands, comparison, is_test exclusion) run on seeded practice rows in `test/kirkpatrick/**`; the conformance
 * database holds no completed T4/T5 practice, so the level routes are asserted on shape, status and scope.
 */

const UNKNOWN_ID = '987654321'

const LEVEL_PATHS = [
  '/kirkpatrick/overview',
  '/kirkpatrick/reaction',
  '/kirkpatrick/learning',
  '/kirkpatrick/behavior',
  '/kirkpatrick/results',
  '/kirkpatrick/chain',
  '/kirkpatrick/filter-options',
  '/kirkpatrick/interventions',
]
const STAFF: ActorRole[] = ['admin', 'teacher', 'school_admin']

function noStore(ctx: ScenarioContext, res: { headers: Record<string, string> }, what: string): void {
  ctx.check((res.headers['cache-control'] ?? '').includes('no-store'), `${what} is missing Cache-Control: no-store`)
}

const rowsIn = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? (value as Record<string, unknown>[]) : [])

async function ownId(who: HttpClient): Promise<string> {
  return String(dataOf(await who.request('GET', '/me')).id)
}

export const kirkpatrickScenarios: Scenario[] = [
  {
    id: 'kirkpatrick-api/anonymous is 401 on all 14 routes',
    domain: 'kirkpatrick',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of [...LEVEL_PATHS, '/kirkpatrick/students/1', '/kirkpatrick/me', '/kirkpatrick/export-pdf', '/feedback/status']) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      }
      for (const path of ['/kirkpatrick/interventions', '/feedback']) {
        expectError(ctx, await anon.request('POST', path, { body: {} }), 401, 'UNAUTHORIZED')
      }
    },
  },
  {
    id: 'kirkpatrick-api/levels: admin, teacher and school_admin are 200 with no-store on pupil data; a student is 403 everywhere but me and feedback',
    domain: 'kirkpatrick',
    targets: ['api'],
    async run(ctx) {
      for (const role of STAFF) {
        const who = await ctx.as(role)
        for (const path of LEVEL_PATHS) ctx.expectStatus(await who.request('GET', path), 200)
        noStore(ctx, await who.request('GET', '/kirkpatrick/results'), `${role} results`)
        noStore(ctx, await who.request('GET', '/kirkpatrick/interventions'), `${role} interventions`)
      }
      const student = await ctx.as('student')
      for (const path of [...LEVEL_PATHS, '/kirkpatrick/students/1', '/kirkpatrick/export-pdf']) {
        expectError(ctx, await student.request('GET', path), 403, 'FORBIDDEN')
      }
      expectError(ctx, await student.request('POST', '/kirkpatrick/interventions', { body: {} }), 403, 'FORBIDDEN')
      for (const path of ['/kirkpatrick/me', '/feedback/status']) ctx.expectStatus(await student.request('GET', path), 200)
    },
  },
  {
    id: 'kirkpatrick-api/scope: a malformed schoolId is 422, an unknown school is the zero state, teacher and school_admin are forced to the own school',
    domain: 'kirkpatrick',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      for (const path of ['overview', 'learning', 'behavior', 'results']) {
        const bad = await admin.request('GET', `/kirkpatrick/${path}?schoolId=abc`)
        expectError(ctx, bad, 422, 'VALIDATION_ERROR')
        ctx.check(
          (errorOf(bad).fields as Record<string, unknown> | undefined)?.schoolId === 'Medan ini tidak sah.',
          `${path}: 422 must name fields.schoolId "Medan ini tidak sah."`,
        )
      }
      const unknown = await admin.request('GET', `/kirkpatrick/overview?schoolId=${UNKNOWN_ID}`)
      ctx.expectStatus(unknown, 200)
      ctx.check((dataOf(unknown).kpi as { t4t5?: unknown }).t4t5 === 0, 'unknown school must be the zero state')

      // The school_admin and teacher accounts both belong to DEMO001: whatever school they ask for, they get it.
      const options = dataOf(await admin.request('GET', '/kirkpatrick/filter-options'))
      const schools = options.schools as { id: string; name: string }[]
      ctx.check(schools.length >= 2, 'filter options must list at least the two demo schools')
      for (const role of ['teacher', 'school_admin'] as ActorRole[]) {
        const who = await ctx.as(role)
        const answers = new Set<string>()
        for (const s of schools) {
          const overview = dataOf(await who.request('GET', `/kirkpatrick/overview?schoolId=${s.id}`))
          answers.add(String((overview.scope as { schoolId?: unknown }).schoolId))
        }
        ctx.check(answers.size === 1, `${role}: the school asked for must not change the school served`)
      }
      const own = await (await ctx.as('school_admin')).request('GET', '/kirkpatrick/filter-options')
      ctx.check(rowsIn(dataOf(own).schools).length === 1, 'school_admin must see only the own school in the filter options')
    },
  },
  {
    id: 'kirkpatrick-api/pupil views: one uniform 403 for ids that are not pupils in scope, 404 for a non-numeric id, me for every role',
    domain: 'kirkpatrick',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      const student = await ctx.as('student')
      const teacher = await ctx.as('teacher')
      const studentId = await ownId(student)
      const adminId = await ownId(admin)

      const open = await admin.request('GET', `/kirkpatrick/students/${studentId}`)
      ctx.expectStatus(open, 200)
      noStore(ctx, open, 'students/:id')
      // A teacher opens only pupils of the own classes: the pupil joins a class of the teacher first.
      const subjectId = String(listOf(await teacher.request('GET', '/subjects'))[0]?.id)
      const cls = dataOf(await teacher.request('POST', '/guru/classes', { body: { name: 'Kelas Murid', subjectId, educationLevel: 'tingkatan-4' } }))
      ctx.expectStatus(await student.request('POST', '/kelas-saya/join', { body: { classCode: String(cls.joinCode) } }), 201)
      ctx.expectStatus(await teacher.request('GET', `/kirkpatrick/students/${studentId}`), 200)
      for (const id of [UNKNOWN_ID, adminId, '0']) {
        expectError(ctx, await admin.request('GET', `/kirkpatrick/students/${id}`), 403, 'FORBIDDEN')
        expectError(ctx, await teacher.request('GET', `/kirkpatrick/students/${id}`), 403, 'FORBIDDEN')
      }
      // A non-numeric id is 404 "Not Found." (contract prose); the operation declares only 200, 401 and 403, so
      // the runner would flag it as undocumented. It is asserted in test/kirkpatrick/pupil-export.spec.ts instead.

      for (const role of ['student', 'teacher', 'school_admin', 'admin'] as ActorRole[]) {
        const me = await (await ctx.as(role)).request('GET', '/kirkpatrick/me')
        ctx.expectStatus(me, 200)
        noStore(ctx, me, `${role} me`)
        ctx.check(((dataOf(me).days as unknown[]) ?? []).length === 30, `${role}: me must hold 30 days`)
      }
    },
  },
  {
    id: 'kirkpatrick-api/export-pdf: %PDF body, application/pdf and the contract file name for staff, 403 for a student',
    domain: 'kirkpatrick',
    targets: ['api'],
    async run(ctx) {
      for (const role of STAFF) {
        const res = await (await ctx.as(role)).request('GET', '/kirkpatrick/export-pdf')
        ctx.expectStatus(res, 200)
        ctx.check((res.headers['content-type'] ?? '').startsWith('application/pdf'), `${role}: content-type must be application/pdf`)
        ctx.check(
          res.headers['content-disposition'] === 'attachment; filename="laporan-kirkpatrick.pdf"',
          `${role}: unexpected content-disposition ${String(res.headers['content-disposition'])}`,
        )
        noStore(ctx, res, `${role} export-pdf`)
        ctx.check(Number(res.headers['content-length']) > 200, `${role}: the PDF is empty`)
      }
      expectError(ctx, await (await ctx.as('student')).request('GET', '/kirkpatrick/export-pdf'), 403, 'FORBIDDEN')
    },
  },
  {
    id: 'kirkpatrick-api/feedback: once per month (409), 422 on bad scores, CSRF_INVALID without the token, role and school from the session',
    domain: 'kirkpatrick',
    targets: ['api'],
    async run(ctx) {
      const student = await ctx.as('student')
      const before = dataOf(await student.request('GET', '/feedback/status'))
      ctx.check(/^\d{4}-\d{2}$/.test(String(before.month)), 'status month must be YYYY-MM')

      const bad = await student.request('POST', '/feedback', { body: { nps: 11, satisfaction: 0 } })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      const fields = errorOf(bad).fields as Record<string, string>
      ctx.check(fields.nps === 'Medan ini tidak sah.' && fields.satisfaction === 'Medan ini tidak sah.', 'bad scores must be "Medan ini tidak sah."')
      const blank = await student.request('POST', '/feedback', { body: {} })
      expectError(ctx, blank, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(blank).fields as Record<string, string>).nps === 'Medan ini diperlukan.', 'blank nps must be "Medan ini diperlukan."')

      const noCsrf = await ctx.as('student', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/feedback', { body: { nps: 5, satisfaction: 3 } }), 403, 'CSRF_INVALID')

      if (before.answered !== true) {
        const created = await student.request('POST', '/feedback', { body: { nps: 9, satisfaction: 5, role: 'admin', schoolId: '1' } })
        ctx.expectStatus(created, 201)
        const row = dataOf(created)
        ctx.check(row.role === 'student' && row.nps === 9 && row.satisfaction === 5, 'stored response must carry the session role and the scores')
      }
      const second = await student.request('POST', '/feedback', { body: { nps: 1, satisfaction: 1 } })
      expectError(ctx, second, 409, 'CONFLICT')
      ctx.check(errorOf(second).message === 'Anda sudah mengisi maklum balas untuk bulan ini.', 'conflict message')
      ctx.check(dataOf(await student.request('GET', '/feedback/status')).answered === true, 'status must be answered after a response')

      const teacher = await ctx.as('teacher')
      if (dataOf(await teacher.request('GET', '/feedback/status')).answered !== true) {
        const t = await teacher.request('POST', '/feedback', { body: { nps: '7', satisfaction: '4' } })
        ctx.expectStatus(t, 201)
        ctx.check(dataOf(t).role === 'teacher', 'a teacher response must carry role teacher')
      }
      const reaction = dataOf(await (await ctx.as('admin')).request('GET', '/kirkpatrick/reaction'))
      ctx.check(typeof reaction.npsStudent === 'number' && (reaction.npsStudent as number) > 0, 'reaction must count the student response')
    },
  },
  {
    id: 'kirkpatrick-api/interventions: round trip, scope, typed 422 refusals and sensitive notes',
    domain: 'kirkpatrick',
    targets: ['api'],
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const student = await ctx.as('student')
      const admin = await ctx.as('admin')
      const schoolAdmin = await ctx.as('school_admin')
      const studentId = await ownId(student)

      // The pupil joins a class of the teacher, so the pupil is "in scope" for the teacher.
      const subjects = await teacher.request('GET', '/subjects')
      const subjectId = String(listOf(subjects)[0]?.id)
      const cls = dataOf(await teacher.request('POST', '/guru/classes', { body: { name: 'Kelas Intervensi', subjectId, educationLevel: 'tingkatan-4' } }))
      ctx.expectStatus(await student.request('POST', '/kelas-saya/join', { body: { classCode: String(cls.joinCode) } }), 201)

      const note = 'Catatan konformans'
      const created = await teacher.request('POST', '/kirkpatrick/interventions', {
        body: { studentId, alertType: 'declining', actionDate: '2026-10-15', alertDescription: note, actionTaken: 'Sesi bimbingan', beforeAccuracy: 40, afterAccuracy: 55, beforeMood: 'sad', afterMood: 'okay' },
      })
      ctx.expectStatus(created, 201)
      const row = dataOf(created)
      ctx.check(row.status === 'Meningkat' && row.studentId === studentId, 'created row must be Meningkat for the pupil')
      noStore(ctx, created, 'POST interventions')

      for (const who of [teacher, schoolAdmin, admin]) {
        const list = await who.request('GET', '/kirkpatrick/interventions')
        ctx.expectStatus(list, 200)
        ctx.check(rowsIn(dataOf(list).rows).some((r) => r.id === row.id), 'the intervention must be listed for staff in scope')
      }

      const refusal = await teacher.request('POST', '/kirkpatrick/interventions', {
        body: { studentId: UNKNOWN_ID, alertType: 'mood', actionDate: '2026-10-15', alertDescription: 'x', actionTaken: 'y' },
      })
      expectError(ctx, refusal, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(refusal).fields as Record<string, string>).studentId === 'Pelajar tidak dijumpai.', 'unknown pupil must be "Pelajar tidak dijumpai."')
      const badDate = await teacher.request('POST', '/kirkpatrick/interventions', {
        body: { studentId, alertType: 'mood', actionDate: '2026-02-30', alertDescription: 'x', actionTaken: 'y' },
      })
      expectError(ctx, badDate, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(badDate).fields as Record<string, string>).actionDate === 'Tarikh tidak sah.', 'bad date must be "Tarikh tidak sah."')
      expectError(ctx, await teacher.request('POST', '/kirkpatrick/interventions', { body: {} }), 422, 'VALIDATION_ERROR')
      const noCsrf = await ctx.as('teacher', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/kirkpatrick/interventions', { body: { studentId } }), 403, 'CSRF_INVALID')
    },
  },
]
