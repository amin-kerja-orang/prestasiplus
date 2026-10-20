import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, expectError, listOf, nextTag } from '../helpers'
import { schoolIdByCode } from '../users/users'

/**
 * School admin (BE-21 slice) scenarios: the school dashboard and the pending-teacher verification (AC 13). They need a cookie
 * session with CSRF and a self-registered teacher of their own, so they run on the API target only.
 */

const PASSWORD = 'Rahsia-Konf-1'

export const schoolAdminScenarios: Scenario[] = [
  {
    id: 'school-admin-api/dashboard: the own school, empty Bijak aggregate without a provider, roles 401/403',
    domain: 'school-admin',
    targets: API_ONLY,
    async run(ctx) {
      const sa = await ctx.as('school_admin')
      const res = await sa.request('GET', '/admin-sekolah/dashboard')
      ctx.expectStatus(res, 200)
      const d = dataOf(res)
      ctx.check((d.school as { code?: string } | undefined)?.code === 'DEMO001', 'the dashboard must be the own school')
      ctx.check(d.roleLabel === 'Admin Sekolah', 'the role label must be Admin Sekolah')
      // A forged schoolId changes nothing.
      const admin = await ctx.as('admin')
      const other = await schoolIdByCode(admin, 'DEMO002')
      const forged = dataOf(await sa.request('GET', `/admin-sekolah/dashboard?schoolId=${other}`))
      ctx.check((forged.school as { code?: string } | undefined)?.code === 'DEMO001', 'a schoolId in the query must be ignored')

      expectError(ctx, await ctx.anonymous().request('GET', '/admin-sekolah/dashboard'), 401, 'UNAUTHORIZED')
      for (const role of ['admin', 'teacher', 'student'] as const) {
        const who = await ctx.as(role)
        expectError(ctx, await who.request('GET', '/admin-sekolah/dashboard'), 403, 'FORBIDDEN')
      }
    },
  },
  {
    id: 'school-admin-api/pending teachers: list, verify, repeat is 404, unknown id is 404',
    domain: 'school-admin',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const school = await schoolIdByCode(admin, 'DEMO001')
      const email = `${nextTag('guru')}@ujian.test`
      const reg = await ctx.anonymous().request('POST', '/auth/register', {
        body: { name: 'Guru Konformans', email, role: 'teacher', schoolId: school, password: PASSWORD, passwordConfirmation: PASSWORD },
      })
      ctx.expectStatus(reg, 201)

      const sa = await ctx.as('school_admin')
      const list = await sa.request('GET', '/admin-sekolah/guru/pending')
      ctx.expectStatus(list, 200)
      const row = listOf(list).find((r) => r.email === email)
      ctx.check(row !== undefined, 'the registered teacher must be pending for the school')
      const id = String(row?.id ?? '')

      const verified = await sa.request('POST', `/admin-sekolah/guru/${id}/verify`)
      ctx.expectStatus(verified, 200)
      const data = dataOf(verified)
      ctx.check(data.isActive === true && data.schoolId === school, 'the verified teacher must be active with the school')

      expectError(ctx, await sa.request('POST', `/admin-sekolah/guru/${id}/verify`), 404, 'NOT_FOUND')
      expectError(ctx, await sa.request('POST', '/admin-sekolah/guru/999999999/verify'), 404, 'NOT_FOUND')
      const after = await sa.request('GET', '/admin-sekolah/guru/pending')
      ctx.check(!listOf(after).some((r) => r.email === email), 'a verified teacher must leave the pending list')
    },
  },
  {
    id: 'school-admin-api/pending teachers: a teacher of another school is not listed, roles and CSRF',
    domain: 'school-admin',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const foreignSchool = await schoolIdByCode(admin, 'DEMO002')
      const email = `${nextTag('guru')}@ujian.test`
      ctx.expectStatus(
        await ctx.anonymous().request('POST', '/auth/register', {
          body: { name: 'Guru Sekolah Lain', email, role: 'teacher', schoolId: foreignSchool, password: PASSWORD, passwordConfirmation: PASSWORD },
        }),
        201,
      )
      const sa = await ctx.as('school_admin')
      ctx.check(!listOf(await sa.request('GET', '/admin-sekolah/guru/pending')).some((r) => r.email === email), 'another school pending teacher must not be listed')

      expectError(ctx, await ctx.anonymous().request('GET', '/admin-sekolah/guru/pending'), 401, 'UNAUTHORIZED')
      expectError(ctx, await ctx.anonymous().request('POST', '/admin-sekolah/guru/1/verify'), 401, 'UNAUTHORIZED')
      for (const role of ['admin', 'teacher', 'student'] as const) {
        const who = await ctx.as(role)
        expectError(ctx, await who.request('GET', '/admin-sekolah/guru/pending'), 403, 'FORBIDDEN')
        expectError(ctx, await who.request('POST', '/admin-sekolah/guru/1/verify'), 403, 'FORBIDDEN')
      }
      const noCsrf = await ctx.as('school_admin', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/admin-sekolah/guru/1/verify'), 403, 'CSRF_INVALID')
    },
  },
]
