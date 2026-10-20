import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, expectError, listOf } from '../helpers'

/**
 * BE-13 (analytics) API-only scenarios: revision, progress, history, corrections and mastery. Every
 * response is also validated against the contract by the client. Deep cases (seeded answers, AC2, AC3)
 * are in `apps/api/test/practice-reads/analytics`.
 */
const ROUTES = [
  '/practice/revision',
  '/practice/revision/MATH',
  '/practice/progress',
  '/practice/history',
  '/practice/corrections',
  '/practice/mastery',
] as const

export const practiceReadsAnalyticsScenarios: Scenario[] = [
  {
    id: 'practice-reads-analytics-api/anonymous is 401 UNAUTHORIZED on every analytics route',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of ROUTES) expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'practice-reads-analytics-api/revision: overview and one subject agree, an unknown code is 404',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const overview = await student.request('GET', '/practice/revision')
      ctx.expectStatus(overview, 200)
      const o = dataOf(overview)
      ctx.check(typeof o.total === 'number' && Array.isArray(o.subjects), 'revision overview shape differs')
      const one = await student.request('GET', '/practice/revision/math')
      ctx.expectStatus(one, 200)
      ctx.check((dataOf(one).subject as { code?: string } | undefined)?.code === 'MATH', 'subject code must be MATH (case-insensitive lookup)')
      expectError(ctx, await student.request('GET', '/practice/revision/TIADA'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'practice-reads-analytics-api/progress: default period 30, unknown period is 200 with null period',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const def = await student.request('GET', '/practice/progress')
      ctx.expectStatus(def, 200)
      ctx.check(dataOf(def).period === '30', 'default period must be 30')
      const all = await student.request('GET', '/practice/progress?period=all')
      ctx.expectStatus(all, 200)
      ctx.check(dataOf(all).period === 'all', 'period=all must be echoed')
      const bad = await student.request('GET', '/practice/progress?period=bogus')
      ctx.expectStatus(bad, 200)
      ctx.check(dataOf(bad).period === null && dataOf(bad).answered === 0, 'an unknown period must give period null and zero figures')
    },
  },
  {
    id: 'practice-reads-analytics-api/history: page meta with all-time totals, an unknown period lists every session, any role may call it',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const res = await student.request('GET', '/practice/history')
      ctx.expectStatus(res, 200)
      const meta = (res.body as { meta?: { page?: number; pageSize?: number; totals?: unknown } }).meta
      ctx.check(meta?.page === 1 && meta?.pageSize === 15 && typeof meta?.totals === 'object', 'history meta must carry page 1, pageSize 15 and totals')
      ctx.check(listOf(res).length <= 15, 'a history page holds at most 15 rows')
      for (const q of ['?period=week', '?period=month', '?period=year', '?period=bogus&page=abc']) {
        ctx.expectStatus(await student.request('GET', `/practice/history${q}`), 200)
      }
      const teacher = await ctx.as('teacher')
      const t = await teacher.request('GET', '/practice/history')
      ctx.expectStatus(t, 200)
      ctx.check(listOf(t).length === 0, 'a teacher sees only their own (empty) practice history')
    },
  },
  {
    id: 'practice-reads-analytics-api/corrections: month navigation, a malformed month shows the current month',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const cur = await student.request('GET', '/practice/corrections')
      ctx.expectStatus(cur, 200)
      const c = dataOf(cur)
      ctx.check(c.month === '2026-10' && c.nextMonth === null && c.prevMonth === '2026-09', 'current month navigation differs')
      const past = await student.request('GET', '/practice/corrections?month=2026-08')
      ctx.expectStatus(past, 200)
      ctx.check(dataOf(past).nextMonth === '2026-09', 'a past month must link to the next one')
      const bad = await student.request('GET', '/practice/corrections?month=2026-13')
      ctx.expectStatus(bad, 200)
      ctx.check(dataOf(bad).month === '2026-10', 'a malformed month must show the current month')
    },
  },
  {
    id: 'practice-reads-analytics-api/mastery: the L0-L10 scale and the caller cards',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const res = await student.request('GET', '/practice/mastery')
      ctx.expectStatus(res, 200)
      const d = dataOf(res)
      ctx.check(Array.isArray(d.scale) && d.scale.length === 11 && Array.isArray(d.subjects), 'mastery shape differs')
    },
  },
]
