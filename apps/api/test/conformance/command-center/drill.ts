import type { HttpClient, Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'
import { schoolIdByCode } from '../users/users'

/**
 * Command Center drill-down (BE-22, routes 4 to 11): the 200 paths on the seeded demo school, the 404 for every unknown id (a
 * scope miss is never 403), the 422 of the week range and the role matrix. The conformance seeds hold no classes or practice
 * rows, so the class, session and headcount routes are exercised through their 404.
 */

const ATS_FORBIDDEN = ['student'] as const

async function userIdByEmail(admin: HttpClient, email: string): Promise<string> {
  const id = listOf(await admin.request('GET', `/admin/users?search=${encodeURIComponent(email)}`)).find((u) => u.email === email)?.id
  if (typeof id !== 'string') throw new Error(`seeded user ${email} not found`)
  return id
}

export const drillScenarios: Scenario[] = [
  {
    id: 'command-center-api/drill: school and teacher pages of the demo school for admin, school admin and teacher',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const school = await schoolIdByCode(admin, 'DEMO001')
      const teacherId = await userIdByEmail(admin, 'guru@demo.test')
      const res = await admin.request('GET', `/command-center/school/${school}`)
      ctx.expectStatus(res, 200)
      ctx.check((dataOf(res).school as { id?: string } | undefined)?.id === school, 'the school page must be the requested school')
      ctx.expectStatus(await admin.request('GET', `/command-center/school/${school}/teacher/${teacherId}`), 200)

      const sa = await ctx.as('school_admin')
      ctx.expectStatus(await sa.request('GET', `/command-center/school/${school}`), 200)
      const other = await schoolIdByCode(admin, 'DEMO002')
      expectError(ctx, await sa.request('GET', `/command-center/school/${other}`), 404, 'NOT_FOUND')

      const teacher = await ctx.as('teacher')
      expectError(ctx, await teacher.request('GET', `/command-center/school/${other}`), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', '/command-center/school/999999999'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', `/command-center/school/${school}/teacher/999999999`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'command-center-api/drill: student page and session lists, the week range 422',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const studentId = await userIdByEmail(admin, 'pelajar@demo.test')
      const page = await admin.request('GET', `/command-center/student/${studentId}`)
      ctx.expectStatus(page, 200)
      ctx.check((dataOf(page).weeks as unknown[] | undefined)?.length === 8, 'the student page must carry 8 weeks')
      ctx.expectStatus(await admin.request('GET', `/command-center/student/${studentId}/subject?code=BM`), 200)
      ctx.expectStatus(await admin.request('GET', `/command-center/student/${studentId}/subject`), 200)
      ctx.expectStatus(await admin.request('GET', `/command-center/student/${studentId}/week?start=2026-10-12&end=2026-10-18`), 200)

      const bad = await admin.request('GET', `/command-center/student/${studentId}/week?start=2026-10-18&end=2026-10-12`)
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check(errorOf(bad).message === 'Julat tarikh tidak sah.', 'the range error must carry the BM message')

      const teacherId = await userIdByEmail(admin, 'guru@demo.test')
      expectError(ctx, await admin.request('GET', `/command-center/student/${teacherId}`), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', '/command-center/student/999999999/week?start=bad&end=bad'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'command-center-api/drill: class, session and headcount ids that do not exist are 404',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      expectError(ctx, await admin.request('GET', '/command-center/classroom/999999999'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', '/command-center/headcount/999999999'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', '/command-center/session/00000000-0000-4000-8000-000000000000'), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('GET', '/command-center/session/not-a-session'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'command-center-api/drill: every drill route is 401 without a session and 403 for a student',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const paths = [
        '/command-center/school/1',
        '/command-center/school/1/teacher/1',
        '/command-center/classroom/1',
        '/command-center/headcount/1',
        '/command-center/student/1',
        '/command-center/student/1/subject',
        '/command-center/student/1/week?start=2026-10-12&end=2026-10-18',
        '/command-center/session/00000000-0000-4000-8000-000000000000',
      ]
      for (const path of paths) {
        expectError(ctx, await ctx.anonymous().request('GET', path), 401, 'UNAUTHORIZED')
        for (const role of ATS_FORBIDDEN) expectError(ctx, await (await ctx.as(role)).request('GET', path), 403, 'FORBIDDEN')
      }
    },
  },
]
