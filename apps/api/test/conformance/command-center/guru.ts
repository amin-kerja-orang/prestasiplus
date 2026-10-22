import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, errorOf, expectError } from '../helpers'

const BASE = '/guru/command-center'
const ROUTES = [`${BASE}/live-data`, `${BASE}/drill?type=students`, `${BASE}/evaluate`, `${BASE}/predictive`, `${BASE}/achievements`] as const

const bodyOf = (res: { body: unknown }): Record<string, unknown> => (res.body !== null && typeof res.body === 'object' ? (res.body as Record<string, unknown>) : {})

/** Teacher Command Center (BE-22, routes 12 to 17): bare bodies, teacher and admin only. */
export const commandCenterGuruScenarios: Scenario[] = [
  {
    id: 'command-center-guru/read routes: bare bodies for teacher and admin, 401 anonymous, 403 student and school admin',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['teacher', 'admin'] as const) {
        const who = await ctx.as(role)
        for (const path of ROUTES) {
          const res = await who.request('GET', path)
          ctx.expectStatus(res, 200)
          ctx.check(!('data' in bodyOf(res)), `${path} answers a bare body (no { data } envelope) for ${role}`)
        }
      }
      for (const path of ROUTES) {
        expectError(ctx, await ctx.anonymous().request('GET', path), 401, 'UNAUTHORIZED')
        for (const role of ['student', 'school_admin'] as const) expectError(ctx, await (await ctx.as(role)).request('GET', path), 403, 'FORBIDDEN')
      }
    },
  },
  {
    id: 'command-center-guru/live-data: figures are the viewer\'s own, counts are formatted strings with raw twins',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const body = bodyOf(await teacher.request('GET', `${BASE}/live-data`))
      ctx.check(typeof body.totalStudents === 'string' && Number.isInteger(body.totalStudentsRaw), 'totalStudents is a string and totalStudentsRaw an integer')
      ctx.check(Array.isArray(body.classes) && Array.isArray(body.topStudents) && Array.isArray(body.recentFeed), 'list fields are arrays')
      const mood = body.mood as Record<string, unknown>
      ctx.check(['happy', 'okay', 'sad', 'stressed'].every((k) => Number.isInteger(mood[k])), 'mood holds the four counts')
    },
  },
  {
    id: 'command-center-guru/drill: 422 texts for a bad type or filter',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const badType = await teacher.request('GET', `${BASE}/drill?type=nope`)
      ctx.expectStatus(badType, 422)
      ctx.check(errorOf(badType).code === 'VALIDATION_ERROR' && errorOf(badType).message === 'Jenis drill tidak sah.', 'bad type: Jenis drill tidak sah.')
      const badFilter = await teacher.request('GET', `${BASE}/drill?type=kirk`)
      ctx.expectStatus(badFilter, 422)
      ctx.check(errorOf(badFilter).message === 'Penapis tidak sah.', 'kirk without filter: Penapis tidak sah.')
      for (const type of ['students', 'today', 'subjects', 'gps', 'mood', 'engagement']) ctx.expectStatus(await teacher.request('GET', `${BASE}/drill?type=${type}`), 200)
      ctx.expectStatus(await teacher.request('GET', `${BASE}/drill?type=kirk&filter=t2`), 200)
    },
  },
  {
    id: 'command-center-guru/badge-holders: 422 for a bad id, 404 with the BM message for an unknown badge',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const bad = await teacher.request('GET', `${BASE}/badge-holders?badgeId=abc`)
      ctx.expectStatus(bad, 422)
      ctx.check(errorOf(bad).message === 'Lencana tidak sah.', 'bad id: Lencana tidak sah.')
      const unknown = await teacher.request('GET', `${BASE}/badge-holders?badgeId=999999`)
      expectError(ctx, unknown, 404, 'NOT_FOUND')
      ctx.check(errorOf(unknown).message === 'Lencana tidak dijumpai.', 'unknown badge: Lencana tidak dijumpai.')
      expectError(ctx, await ctx.anonymous().request('GET', `${BASE}/badge-holders?badgeId=1`), 401, 'UNAUTHORIZED')
      expectError(ctx, await (await ctx.as('student')).request('GET', `${BASE}/badge-holders?badgeId=1`), 403, 'FORBIDDEN')
    },
  },
]
