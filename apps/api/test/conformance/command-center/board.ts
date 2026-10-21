import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, expectError } from '../helpers'
import { schoolIdByCode } from '../users/users'

/**
 * Command Center board (BE-22, admin / school half): live-data, daily-activity and its school drill. The conformance seeds hold no
 * practice answers, so these scenarios check the shapes of an empty log, the scope rules and the role matrix.
 */
export const commandCenterBoardScenarios: Scenario[] = [
  {
    id: 'command-center-api/live-data: platform for admin, school view for school admin (session school only), roles 401/403',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const res = await admin.request('GET', '/admin/command-center/live-data')
      ctx.expectStatus(res, 200)
      const d = dataOf(res)
      ctx.check(d.scope === 'platform' && d.school === null, 'the admin gets the platform view')
      ctx.check(Array.isArray(d.topSchools) && Array.isArray(d.recentFeed), 'lists are arrays')

      const sa = await ctx.as('school_admin')
      const other = await schoolIdByCode(admin, 'DEMO002')
      const own = dataOf(await sa.request('GET', '/admin/command-center/live-data'))
      const forged = dataOf(await sa.request('GET', `/admin/command-center/live-data?schoolId=${other}`))
      ctx.check(own.scope === 'school', 'the school admin gets the school view')
      ctx.check((forged.school as { id?: string } | null)?.id === (own.school as { id?: string } | null)?.id, 'a schoolId in the query must be ignored')
      ctx.check((own.dailyTrend as unknown[]).length === 7 && (own.topSchools as unknown[]).length === 0, 'school view: 7 trend days, no top schools')

      expectError(ctx, await ctx.anonymous().request('GET', '/admin/command-center/live-data'), 401, 'UNAUTHORIZED')
      for (const role of ['teacher', 'student'] as const)
        expectError(ctx, await (await ctx.as(role)).request('GET', '/admin/command-center/live-data'), 403, 'FORBIDDEN')
    },
  },
  {
    id: 'command-center-api/daily-activity: periods echo the raw value, school admin has no schools list, roles 401/403',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      for (const [period, label] of [
        ['week', 'Minggu Ini'],
        ['month', 'Bulan Ini'],
      ] as const) {
        const d = dataOf(await admin.request('GET', `/command-center/daily-activity?period=${period}`))
        ctx.check(d.period === period && d.label === label, `period ${period}`)
      }
      const odd = dataOf(await admin.request('GET', '/command-center/daily-activity?period=bukan'))
      ctx.check(odd.period === 'bukan' && String(odd.label).startsWith('Hari Ini ('), 'an unknown period answers with today and echoes the raw value')
      ctx.check(Array.isArray(odd.schools), 'the platform view has the schools list')

      const sa = await ctx.as('school_admin')
      const school = dataOf(await sa.request('GET', '/command-center/daily-activity'))
      ctx.check(school.scope === 'school' && school.schools === undefined, 'school view omits the schools list')

      expectError(ctx, await ctx.anonymous().request('GET', '/command-center/daily-activity'), 401, 'UNAUTHORIZED')
      for (const role of ['teacher', 'student'] as const)
        expectError(ctx, await (await ctx.as(role)).request('GET', '/command-center/daily-activity'), 403, 'FORBIDDEN')
    },
  },
  {
    id: 'command-center-api/daily-activity school drill: admin only, unknown school 404',
    domain: 'command-center',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const school = await schoolIdByCode(admin, 'DEMO001')
      const res = await admin.request('GET', `/command-center/daily-activity/school/${school}?period=week`)
      ctx.expectStatus(res, 200)
      const d = dataOf(res)
      ctx.check((d.school as { id?: string }).id === school && d.period === 'week', 'the drill is of the asked school and echoes the period')
      for (const key of ['teachers', 'students', 'logins']) ctx.check(Array.isArray(d[key]), `${key} is an array`)

      expectError(ctx, await admin.request('GET', '/command-center/daily-activity/school/99999999'), 404, 'NOT_FOUND')
      expectError(ctx, await ctx.anonymous().request('GET', `/command-center/daily-activity/school/${school}`), 401, 'UNAUTHORIZED')
      for (const role of ['school_admin', 'teacher', 'student'] as const)
        expectError(ctx, await (await ctx.as(role)).request('GET', `/command-center/daily-activity/school/${school}`), 403, 'FORBIDDEN')
    },
  },
]
