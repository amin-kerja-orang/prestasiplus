import type { ActorRole, HttpClient, Scenario, ScenarioContext } from '@pp/contract-tests'

import { dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * M11 teacher analytics and monitoring (BE-20): the 7 routes, the guards, the scope rules of the contract (teacher and
 * school_admin forced to the own school; unknown, foreign and non-numeric ids 404), the export format 422 and the
 * teacher report / item analysis for admin and teacher. Every 200 body is also checked against the contract schema by
 * the runner. The figure checks (engagement, tahap, flags, windows, is_test exclusion, discrimination) run on seeded
 * practice rows in `test/analytics/**`; the conformance database holds no completed T4/T5 practice.
 */

const UNKNOWN_ID = '987654321'
const STAFF: ActorRole[] = ['admin', 'teacher', 'school_admin']

function noStore(ctx: ScenarioContext, res: { headers: Record<string, string> }, what: string): void {
  ctx.check((res.headers['cache-control'] ?? '').includes('no-store'), `${what} is missing Cache-Control: no-store`)
}

const rowsIn = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? (value as Record<string, unknown>[]) : [])

/** The school of a teacher or school admin: the only school their monitoring overview lists. */
async function ownSchool(ctx: ScenarioContext, who: HttpClient): Promise<string> {
  const overview = dataOf(await who.request('GET', '/monitoring/overview'))
  const id = String(rowsIn(overview.teacherRows)[0]?.schoolId ?? rowsIn(overview.studentRows)[0]?.schoolId)
  ctx.check(/^\d+$/.test(id), 'the overview of a school-scoped role must list the own school')
  return id
}

export const analyticsScenarios: Scenario[] = [
  {
    id: 'analytics-api/anonymous is 401 on all 7 routes',
    domain: 'analytics',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of [
        '/monitoring/overview',
        '/monitoring/export?format=csv',
        '/monitoring/schools/1',
        '/monitoring/schools/1/students/1',
        '/monitoring/schools/1/teachers/1',
        '/teacher/report',
        '/teacher/item-analysis',
      ]) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      }
    },
  },
  {
    id: 'analytics-api/roles: monitoring for admin, teacher and school_admin; teacher report and item analysis for admin and teacher; a student is 403 everywhere',
    domain: 'analytics',
    targets: ['api'],
    async run(ctx) {
      for (const role of STAFF) {
        const who = await ctx.as(role)
        ctx.expectStatus(await who.request('GET', '/monitoring/overview'), 200)
        ctx.expectStatus(await who.request('GET', '/monitoring/export?format=pdf'), 200)
      }
      for (const role of ['admin', 'teacher'] as ActorRole[]) {
        const who = await ctx.as(role)
        for (const path of ['/teacher/report', '/teacher/item-analysis']) {
          const res = await who.request('GET', path)
          ctx.expectStatus(res, 200)
          noStore(ctx, res, `${role} ${path}`)
        }
      }
      const schoolAdmin = await ctx.as('school_admin')
      const student = await ctx.as('student')
      for (const path of ['/teacher/report', '/teacher/item-analysis']) {
        expectError(ctx, await schoolAdmin.request('GET', path), 403, 'FORBIDDEN')
      }
      for (const path of ['/monitoring/overview', '/monitoring/export?format=csv', '/monitoring/schools/1', '/monitoring/schools/1/students/1', '/monitoring/schools/1/teachers/1', '/teacher/report', '/teacher/item-analysis']) {
        expectError(ctx, await student.request('GET', path), 403, 'FORBIDDEN')
      }
    },
  },
  {
    id: 'analytics-api/overview: invalid filters are tolerated, teacher and school_admin see only the own school',
    domain: 'analytics',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      for (const q of ['period=1y', 'state=Atlantis', 'tahap=Hebat', 'period=7d&state=&tahap=Cemerlang']) {
        ctx.expectStatus(await admin.request('GET', `/monitoring/overview?${q}`), 200)
      }
      const echoed = dataOf(await admin.request('GET', '/monitoring/overview?period=1y')).filters as { period?: unknown }
      ctx.check(echoed.period === '', 'an unknown period must be echoed as an empty string')
      for (const role of ['teacher', 'school_admin'] as ActorRole[]) {
        const who = await ctx.as(role)
        const own = dataOf(await who.request('GET', `/monitoring/overview?state=&schoolId=${UNKNOWN_ID}`))
        const ids = new Set([...rowsIn(own.studentRows), ...rowsIn(own.teacherRows)].map((r) => r.schoolId))
        ctx.check(ids.size === 1, `${role}: the overview must list the own school only`)
        noStore(ctx, await who.request('GET', '/monitoring/overview'), `${role} overview`)
      }
    },
  },
  {
    id: 'analytics-api/export: csv and pdf rows, format 422 with the contract message, own school for teacher and school_admin',
    domain: 'analytics',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      for (const format of ['csv', 'pdf']) {
        const res = await admin.request('GET', `/monitoring/export?format=${format}`)
        ctx.expectStatus(res, 200)
        ctx.check(dataOf(res).filename === `monitoring-penglibatan.${format}`, `filename for ${format}`)
      }
      for (const who of STAFF) {
        const client = await ctx.as(who)
        for (const q of ['', '?format=', '?format=xlsx']) {
          const bad = await client.request('GET', `/monitoring/export${q}`)
          expectError(ctx, bad, 422, 'VALIDATION_ERROR')
          ctx.check((errorOf(bad).fields as Record<string, string> | undefined)?.format === 'Format eksport mesti pdf atau csv.', `${who}${q}: fields.format message`)
        }
      }
      for (const role of ['teacher', 'school_admin'] as ActorRole[]) {
        const rows = rowsIn(dataOf(await (await ctx.as(role)).request('GET', '/monitoring/export?format=csv')).rows)
        ctx.check(new Set(rows.map((r) => r.schoolId)).size <= 1, `${role}: the export must hold the own school only`)
      }
    },
  },
  {
    id: 'analytics-api/school, pupil and teacher detail: admin opens any school; teacher and school_admin only the own one (404 for the rest)',
    domain: 'analytics',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      const teacher = await ctx.as('teacher')
      const schoolAdmin = await ctx.as('school_admin')
      const own = await ownSchool(ctx, schoolAdmin)
      // Schools with at least one user, from the Kirkpatrick filter options: the conformance seed gives the second school
      // (DEMO002) no teacher and no T4/T5 pupil, so its detail is empty and the cross-school pupil / teacher cases run in
      // test/analytics/** on seeded data.
      const options = dataOf(await admin.request('GET', '/kirkpatrick/filter-options'))
      const others = rowsIn(options.schools)
        .map((r) => String(r.id))
        .filter((id) => id !== own)
      ctx.check(others.length > 0, 'the demo data must hold a second school')
      const other = others[0] as string

      const mine = await admin.request('GET', `/monitoring/schools/${own}`)
      ctx.expectStatus(mine, 200)
      noStore(ctx, mine, 'school detail')
      const detail = dataOf(mine)
      const pupil = String(rowsIn(detail.students)[0]?.id)
      const teacherId = String(rowsIn(detail.teachers)[0]?.id)
      ctx.check(/^\d+$/.test(pupil) && /^\d+$/.test(teacherId), 'the own school must list a pupil and a teacher')
      ctx.expectStatus(await admin.request('GET', `/monitoring/schools/${other}`), 200)

      const teacherSelf = String(dataOf(await teacher.request('GET', '/me')).id)
      for (const who of [teacher, schoolAdmin]) {
        const isTeacher = who === teacher
        ctx.expectStatus(await who.request('GET', `/monitoring/schools/${own}`), 200)
        // A teacher opens own-class pupils only (other scenarios may have enrolled this pupil): the school detail says which.
        const listed = rowsIn(dataOf(await who.request('GET', `/monitoring/schools/${own}`)).students).some((r) => String(r.id) === pupil)
        const student = await who.request('GET', `/monitoring/schools/${own}/students/${pupil}`)
        if (isTeacher && !listed) expectError(ctx, student, 404, 'NOT_FOUND')
        else {
          ctx.expectStatus(student, 200)
          noStore(ctx, student, 'pupil detail')
        }
        ctx.check(isTeacher || listed, 'the school admin must list the pupil')
        const tdetail = await who.request('GET', `/monitoring/schools/${own}/teachers/${isTeacher ? teacherSelf : teacherId}`)
        ctx.expectStatus(tdetail, 200)
        noStore(ctx, tdetail, 'teacher detail')
        for (const path of [
          `/monitoring/schools/${other}`,
          `/monitoring/schools/${UNKNOWN_ID}`,
          `/monitoring/schools/${own}/students/${UNKNOWN_ID}`,
          `/monitoring/schools/${other}/students/${pupil}`,
          `/monitoring/schools/${own}/teachers/${UNKNOWN_ID}`,
          `/monitoring/schools/${other}/teachers/${teacherId}`,
          `/monitoring/schools/${own}/teachers/${pupil}`,
        ]) {
          const r404 = await who.request('GET', path)
          ctx.check(r404.status === 404, `${isTeacher ? 'teacher' : 'school_admin'} ${path} expected 404 got ${String(r404.status)}`)
        }
      }
      // Admin: unknown ids and a non-teacher on the teacher page are 404; the school segment is not matched against the pupil.
      expectError(ctx, await admin.request('GET', `/monitoring/schools/${UNKNOWN_ID}`), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', `/monitoring/schools/${own}/teachers/${pupil}`), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', `/monitoring/schools/${own}/students/${UNKNOWN_ID}`), 404, 'NOT_FOUND')
      ctx.expectStatus(await admin.request('GET', `/monitoring/schools/${other}/students/${pupil}`), 200)
      ctx.expectStatus(await admin.request('GET', `/monitoring/schools/${other}/teachers/${teacherId}`), 200)
    },
  },
  {
    id: 'analytics-api/teacher report and item analysis: own classes only, tolerant filters, empty for the admin',
    domain: 'analytics',
    targets: ['api'],
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const admin = await ctx.as('admin')
      const report = dataOf(await teacher.request('GET', '/teacher/report'))
      ctx.check(report.range === 30 && rowsIn((report.trend as unknown[]) ?? []).length === 30, 'default range is 30 days with 30 trend points')
      for (const q of ['range=abc', 'range=999', 'classroomId=987654321', 'classroomId=abc', 'range=7&classroomId=']) {
        ctx.expectStatus(await teacher.request('GET', `/teacher/report?${q}`), 200)
      }
      ctx.check(dataOf(await teacher.request('GET', '/teacher/report?range=7')).range === 7, 'range 7 is echoed')
      ctx.check(dataOf(await teacher.request('GET', '/teacher/report?range=abc')).range === 30, 'a non-number range is 30')

      // A class the teacher owns narrows the population; the same id asked by the admin is ignored.
      const subjects = listOf(await teacher.request('GET', '/subjects'))
      const created = dataOf(
        await teacher.request('POST', '/guru/classes', { body: { name: 'Kelas Analitik', subjectId: String(subjects[0]?.id), educationLevel: 'tingkatan-4' } }),
      )
      const classId = String(created.id)
      const classes = (dataOf(await teacher.request('GET', '/teacher/report')).options as { classes?: { id: string }[] }).classes ?? []
      ctx.check(classes.some((c) => c.id === classId), 'the new class must be an option of the teacher report')
      ctx.check(dataOf(await teacher.request('GET', `/teacher/report?classroomId=${classId}`)).classroomId === classId, 'an own class is echoed')
      const asAdmin = dataOf(await admin.request('GET', `/teacher/report?classroomId=${classId}`))
      ctx.check(asAdmin.classroomId === null && (asAdmin.population as { total?: number }).total === 0, 'the admin has an empty population')

      for (const q of ['', `?classroomId=${classId}`, '?classroomId=987654321', '?subjectId=987654321', '?subjectId=abc']) {
        ctx.expectStatus(await teacher.request('GET', `/teacher/item-analysis${q}`), 200)
      }
      const items = dataOf(await teacher.request('GET', '/teacher/item-analysis?classroomId=987654321'))
      ctx.check(rowsIn(items.rows).length === 0, 'a not-own class gives no rows')
      const adminItems = dataOf(await admin.request('GET', '/teacher/item-analysis'))
      ctx.check(rowsIn(adminItems.rows).length === 0 && rowsIn((adminItems.options as { subjects?: unknown }).subjects).length > 0, 'the admin has no rows but the subject options')
    },
  },
]
