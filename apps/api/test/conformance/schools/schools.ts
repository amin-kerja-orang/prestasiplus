import type { Scenario } from '@pp/contract-tests'

import { dataOf, expectError, listOf, nextTag } from '../helpers'

/**
 * Schools (BE-05) smoke scenarios (BE-31 AC6): the admin routes (list, options, create, read,
 * update, toggle), the public pickers (no session), and a 401 and a 403.
 */
export const schoolsScenarios: Scenario[] = [
  {
    id: 'schools-api/admin lifecycle: list, options, create, read, update, toggle',
    domain: 'schools',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      ctx.expectStatus(await admin.request('GET', '/admin/schools'), 200)
      ctx.expectStatus(await admin.request('GET', '/admin/schools/options'), 200)
      ctx.expectStatus(await admin.request('GET', '/schools?all=1'), 200)
      const code = nextTag('KNF')
      const body = {
        name: 'SMK Konformans',
        code,
        type: 'SMK',
        state: 'Selangor',
        district: 'PPD Gombak',
        city: 'GOMBAK',
        isActive: true,
      }
      const created = await admin.request('POST', '/admin/schools', { body })
      ctx.expectStatus(created, 201)
      const id = String(dataOf(created).id)
      ctx.expectStatus(await admin.request('GET', `/admin/schools/${id}`), 200)
      ctx.expectStatus(await admin.request('PUT', `/admin/schools/${id}`, { body: { ...body, name: 'SMK Konformans Dua' } }), 200)
      const off = await admin.request('POST', `/admin/schools/${id}/toggle`)
      ctx.expectStatus(off, 200)
      ctx.check(dataOf(off).isActive === false, 'toggle did not switch the school off')
      expectError(ctx, await admin.request('GET', '/admin/schools/987654321'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'schools-api/public pickers need no session',
    domain: 'schools',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      ctx.expectStatus(await anon.request('GET', '/schools/search'), 200)
      ctx.expectStatus(await anon.request('GET', '/schools/search?q=Demo'), 200)
      const jpn = await anon.request('GET', '/jpn')
      ctx.expectStatus(jpn, 200)
      const jpnId = String(listOf(jpn)[0]?.id)
      ctx.expectStatus(await anon.request('GET', `/jpn/${jpnId}/ppd`), 200)
    },
  },
  {
    id: 'schools-api/anonymous is 401 on the admin school routes',
    domain: 'schools',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', '/admin/schools'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/admin/schools/options'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', '/admin/schools', { body: {} }), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'schools-api/a student and a teacher are 403 on the admin school routes',
    domain: 'schools',
    targets: ['api'],
    async run(ctx) {
      for (const role of ['student', 'teacher'] as const) {
        const who = await ctx.as(role)
        expectError(ctx, await who.request('GET', '/admin/schools'), 403, 'FORBIDDEN')
        expectError(ctx, await who.request('POST', '/admin/schools', { body: {} }), 403, 'FORBIDDEN')
      }
    },
  },
]
