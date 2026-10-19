import type { HttpClient, Scenario } from '@pp/contract-tests'

import { dataOf, expectError, listOf, nextTag } from '../helpers'

/** Id of a seeded school by its code, read through the schools admin list (the wire has no code lookup). */
export async function schoolIdByCode(admin: HttpClient, code: string): Promise<string> {
  const res = await admin.request('GET', `/admin/schools?search=${code}`)
  const id = listOf(res).find((s) => s.code === code)?.id
  if (typeof id !== 'string') throw new Error(`seeded school ${code} not found`)
  return id
}

/**
 * Users (BE-05) smoke scenarios (BE-31 AC6): one happy-path call per route group, plus a 401
 * (no session) and a 403 (a role without access). Bodies are parsed against the contract by the
 * runner, so a field that drifts from the schema fails here.
 */
export const usersScenarios: Scenario[] = [
  {
    id: 'users-api/admin lifecycle: create, read, update, toggle, delete',
    domain: 'users',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      const schoolId = await schoolIdByCode(admin, 'DEMO001')
      const tag = nextTag('konf')
      const created = await admin.request('POST', '/admin/users', {
        body: { roles: ['teacher'], name: 'Guru Konformans', email: `${tag}@ujian.test`, schoolId },
      })
      ctx.expectStatus(created, 201)
      const id = String(dataOf(created).id)
      ctx.check(typeof dataOf(created).generatedPassword === 'string', 'POST /admin/users did not return a one-time generatedPassword')

      ctx.expectStatus(await admin.request('GET', `/admin/users/${id}`), 200)
      ctx.expectStatus(await admin.request('GET', '/admin/users?search=Konformans'), 200)
      ctx.expectStatus(await admin.request('GET', '/admin/users/filters'), 200)
      const updated = await admin.request('PUT', `/admin/users/${id}`, {
        body: { roles: ['teacher'], name: 'Guru Konformans Dua', schoolId },
      })
      ctx.expectStatus(updated, 200)
      ctx.expectStatus(await admin.request('POST', `/admin/users/${id}/toggle-active`), 200)
      ctx.expectStatus(await admin.request('DELETE', `/admin/users/${id}`), 200)
      expectError(ctx, await admin.request('GET', `/admin/users/${id}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'users-api/bulk-delete and bulk-import answer the contract',
    domain: 'users',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      const none = await admin.request('POST', '/admin/users/bulk-delete', { body: { ids: [] } })
      ctx.check(none.status === 200 || none.status === 422, `bulk-delete of nothing answered ${String(none.status)}`)
      const bad = await admin.request('POST', '/admin/users/bulk-import', { body: {} })
      ctx.expectStatus(bad, 422)
    },
  },
  {
    id: 'users-api/lookups: students/search, teachers, classrooms, school students',
    domain: 'users',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      const teacher = await ctx.as('teacher')
      const schoolId = await schoolIdByCode(admin, 'DEMO001')
      ctx.expectStatus(await admin.request('GET', '/students/search?q=Murid'), 200)
      ctx.expectStatus(await teacher.request('GET', '/students/search?q=Murid'), 200)
      const teachers = await admin.request('GET', '/admin/teachers')
      ctx.expectStatus(teachers, 200)
      const teacherId = String(listOf(teachers)[0]?.id)
      ctx.expectStatus(await admin.request('GET', `/admin/teachers/${teacherId}/classrooms`), 200)
      ctx.expectStatus(await admin.request('GET', `/admin/schools/${schoolId}/students`), 200)
    },
  },
  {
    id: 'users-api/anonymous is 401 on every users route group',
    domain: 'users',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of ['/admin/users', '/admin/users/filters', '/admin/teachers', '/students/search?q=Murid']) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      }
      expectError(ctx, await anon.request('POST', '/admin/users', { body: {} }), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'users-api/a student is 403 on the admin users routes, a teacher on user admin',
    domain: 'users',
    targets: ['api'],
    async run(ctx) {
      const student = await ctx.as('student')
      expectError(ctx, await student.request('GET', '/admin/users'), 403, 'FORBIDDEN')
      expectError(ctx, await student.request('POST', '/admin/users', { body: {} }), 403, 'FORBIDDEN')
      expectError(ctx, await student.request('GET', '/students/search?q=Murid'), 403, 'FORBIDDEN')
      const teacher = await ctx.as('teacher')
      expectError(ctx, await teacher.request('GET', '/admin/users'), 403, 'FORBIDDEN')
      expectError(ctx, await teacher.request('GET', '/admin/teachers'), 403, 'FORBIDDEN')
    },
  },
  {
    id: 'users-api/a write without the CSRF token is 403 CSRF_INVALID',
    domain: 'users',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin', { csrf: false })
      expectError(ctx, await admin.request('POST', '/admin/users', { body: {} }), 403, 'CSRF_INVALID')
    },
  },
]
