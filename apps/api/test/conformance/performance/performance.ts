import type { ActorRole, HttpClient, Scenario, ScenarioContext } from '@pp/contract-tests'

import { dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Prestasi, Analitik and Analisa Item (BE-19 slice, US-33): the 12 routes over the Bijak aggregate.
 *
 * The conformance app boots the real module graph, so these scenarios read the REAL data port. BE-16
 * (Bijak attempts) is not merged, so that port is empty: the scenarios assert envelope, roles, status
 * codes, `Cache-Control: no-store` and the empty-state payloads (every 200 body is also checked against
 * the contract schema by the runner). The value checks (totals, redaction, scope, MIN_COHORT) run on
 * Part A's in-memory fakes in the HTTP tests (the suite has no provider-override hook).
 *
 * RE-POINT AFTER BE-16 MERGES (marked NEEDS-BE16 below): those scenarios assert the empty state and must
 * be re-pointed at the Bijak PoC seed (non-empty totals, class total = sum of pupils, item rows with a
 * question snapshot). The 401, 403, 404 and no-store scenarios stay as they are.
 * ppd_officer and jpn_officer have no seeded account (accounts.ts), so officer scope is covered by the
 * HTTP tests only.
 */

const ALL_ROUTES = [
  '/analytics/me',
  '/analytics/classes',
  '/performance/school',
  '/performance/levels',
  '/performance/classes',
  '/item-analysis/school',
  '/item-analysis/classes',
  '/performance/students/1',
  '/performance/levels/t4',
  '/performance/classes/1',
  '/item-analysis/school/1',
  '/item-analysis/classes/1',
]
const UNKNOWN_ID = '987654321'
const FOUR_ROLES: ActorRole[] = ['student', 'teacher', 'school_admin', 'admin']

function noStore(ctx: ScenarioContext, res: { headers: Record<string, string> }, what: string): void {
  ctx.check((res.headers['cache-control'] ?? '').includes('no-store'), `${what} is missing Cache-Control: no-store`)
}

async function ownId(who: HttpClient): Promise<string> {
  return String(dataOf(await who.request('GET', '/me')).id)
}

export const performanceScenarios: Scenario[] = [
  {
    id: 'performance-api/anonymous is 401 on all 12 routes',
    domain: 'performance',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of ALL_ROUTES) expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'performance-api/analytics: own payload for every role, class analytics for admin and teacher only',
    domain: 'performance',
    targets: ['api'],
    async run(ctx) {
      for (const role of FOUR_ROLES) {
        const res = await (await ctx.as(role)).request('GET', '/analytics/me')
        ctx.expectStatus(res, 200)
        noStore(ctx, res, '/analytics/me')
      }
      for (const role of ['admin', 'teacher'] as ActorRole[]) {
        const who = await ctx.as(role)
        ctx.expectStatus(await who.request('GET', '/analytics/classes'), 200)
        // an unknown risk level is treated as "all"
        ctx.expectStatus(await who.request('GET', '/analytics/classes?riskLevel=bogus'), 200)
      }
      for (const role of ['student', 'school_admin'] as ActorRole[]) {
        expectError(ctx, await (await ctx.as(role)).request('GET', '/analytics/classes'), 403, 'FORBIDDEN')
      }
    },
  },
  {
    id: 'performance-api/student 360: self and admin are 200, unknown and not visible are 404 (contract says 403)',
    domain: 'performance',
    targets: ['api'],
    async run(ctx) {
      const student = await ctx.as('student')
      const admin = await ctx.as('admin')
      const studentId = await ownId(student)
      const self = await student.request('GET', `/performance/students/${studentId}`)
      ctx.expectStatus(self, 200)
      noStore(ctx, self, 'student 360')
      expectError(ctx, await student.request('GET', `/performance/students/${UNKNOWN_ID}`), 404, 'NOT_FOUND')
      // the demo admin is a real user a student may not open: the same 404, so ids cannot be enumerated
      const adminId = await ownId(admin)
      expectError(ctx, await student.request('GET', `/performance/students/${adminId}`), 404, 'NOT_FOUND')
      ctx.expectStatus(await admin.request('GET', `/performance/students/${studentId}`), 200)
      expectError(ctx, await admin.request('GET', `/performance/students/${UNKNOWN_ID}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'performance-api/school, levels and classes: empty state for every role (NEEDS-BE16)',
    domain: 'performance',
    targets: ['api'],
    async run(ctx) {
      for (const role of FOUR_ROLES) {
        const who = await ctx.as(role)
        for (const path of ['/performance/school', '/performance/levels', '/performance/classes']) {
          const res = await who.request('GET', path)
          ctx.expectStatus(res, 200)
          noStore(ctx, res, path)
        }
        const levels = listOf(await who.request('GET', '/performance/levels'))
        ctx.check(
          levels.length === 2 && levels[0]?.code === 't4' && levels[1]?.code === 't5',
          `${role}: /performance/levels must list t4 and t5`,
        )
      }
      // only a teacher has own classes; every other role gets an empty list
      for (const role of ['student', 'school_admin', 'admin'] as ActorRole[]) {
        const rows = listOf(await (await ctx.as(role)).request('GET', '/performance/classes'))
        ctx.check(rows.length === 0, `${role}: /performance/classes must be [] for a non-teacher`)
      }
    },
  },
  {
    id: 'performance-api/level detail: t4 and t5 are 200, any other code is 404',
    domain: 'performance',
    targets: ['api'],
    async run(ctx) {
      const admin = await ctx.as('admin')
      for (const code of ['t4', 't5']) ctx.expectStatus(await admin.request('GET', `/performance/levels/${code}`), 200)
      for (const code of ['t9', 'abc', '0']) {
        expectError(ctx, await admin.request('GET', `/performance/levels/${code}`), 404, 'NOT_FOUND')
      }
    },
  },
  {
    id: 'performance-api/class dashboard: unknown and hostile ids are 404 (never 500), no-store on the 404',
    domain: 'performance',
    targets: ['api'],
    async run(ctx) {
      for (const role of ['admin', 'teacher'] as ActorRole[]) {
        const who = await ctx.as(role)
        for (const id of [UNKNOWN_ID, 'abc', '99999999999999999999', '..%2F..%2Fetc']) {
          const res = await who.request('GET', `/performance/classes/${id}`)
          ctx.expectStatus(res, 404)
          noStore(ctx, res, `/performance/classes/${id}`)
        }
      }
      // a role that may not open class dashboards gets the same 404 (no existence leak)
      expectError(ctx, await (await ctx.as('student')).request('GET', `/performance/classes/${UNKNOWN_ID}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'performance-api/item analysis school: own variant by school, query and scope rules (NEEDS-BE16)',
    domain: 'performance',
    targets: ['api'],
    async run(ctx) {
      for (const role of FOUR_ROLES) {
        const res = await (await ctx.as(role)).request('GET', '/item-analysis/school')
        // the demo admin has no school: the own variant answers 404 (viewer has no school)
        const expected = role === 'admin' ? 404 : 200
        ctx.check(res.status === expected, `${role} /item-analysis/school: expected ${expected}, got ${res.status}`)
        noStore(ctx, res, '/item-analysis/school')
      }
      const admin = await ctx.as('admin')
      // tingkatan other than T4/T5 is ignored; admin + unknown school = empty payload (FR-M08-143)
      for (const path of [`/item-analysis/school/${UNKNOWN_ID}?tingkatan=T9`, `/item-analysis/school/${UNKNOWN_ID}?tingkatan=T4`, `/item-analysis/school/${UNKNOWN_ID}`]) {
        const res = await admin.request('GET', path)
        ctx.check(res.status === 200, `admin ${path}: expected 200, got ${res.status}`)
      }
      // a non-admin asking for a school outside the own scope is refused, same as for an unknown id
      expectError(ctx, await (await ctx.as('teacher')).request('GET', `/item-analysis/school/${UNKNOWN_ID}`), 403, 'FORBIDDEN')
    },
  },
  {
    id: 'performance-api/item analysis classes: admin and teacher only, unknown id is 403 (same as forbidden)',
    domain: 'performance',
    targets: ['api'],
    async run(ctx) {
      for (const role of ['admin', 'teacher'] as ActorRole[]) {
        const who = await ctx.as(role)
        const res = await who.request('GET', '/item-analysis/classes')
        ctx.expectStatus(res, 200)
        noStore(ctx, res, '/item-analysis/classes')
        expectError(ctx, await who.request('GET', `/item-analysis/classes/${UNKNOWN_ID}`), 403, 'FORBIDDEN')
      }
      for (const role of ['student', 'school_admin'] as ActorRole[]) {
        const who = await ctx.as(role)
        expectError(ctx, await who.request('GET', '/item-analysis/classes'), 403, 'FORBIDDEN')
        expectError(ctx, await who.request('GET', `/item-analysis/classes/${UNKNOWN_ID}`), 403, 'FORBIDDEN')
      }
    },
  },
  {
    id: 'performance-api/errors carry the envelope message and never leak internals',
    domain: 'performance',
    targets: ['api'],
    async run(ctx) {
      const res = await (await ctx.as('student')).request('GET', '/analytics/classes')
      ctx.expectStatus(res, 403)
      const err = errorOf(res)
      ctx.check(typeof err.message === 'string' && err.message.length > 0, '403 must carry error.message')
      ctx.check(!JSON.stringify(res.body).includes('stack'), '403 body must not expose a stack')
    },
  },
]
