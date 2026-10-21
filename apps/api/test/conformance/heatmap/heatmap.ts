import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError } from '../helpers'

/**
 * Heatmap Topik Lemah (BE-48, M25 route #1) API-only scenarios. The conformance database has no answer
 * log, so a signed-in student or admin gets the empty state; the figures, order and test-mode rules are
 * proved in `apps/api/test/heatmap`. Every response is checked against the contract by the runner.
 */
const PATH = '/buku-nota/heatmap'

export const heatmapScenarios: Scenario[] = [
  {
    id: 'heatmap-api/anonymous is 401 UNAUTHORIZED',
    domain: 'heatmap',
    targets: API_ONLY,
    async run(ctx) {
      const res = await ctx.anonymous().request('GET', PATH)
      expectError(ctx, res, 401, 'UNAUTHORIZED')
      ctx.check(errorOf(res).message === 'Unauthenticated.', 'unauthenticated message differs')
    },
  },
  {
    id: 'heatmap-api/teacher and school admin are 403 FORBIDDEN',
    domain: 'heatmap',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['teacher', 'school_admin'] as const) {
        const res = await (await ctx.as(role)).request('GET', PATH)
        expectError(ctx, res, 403, 'FORBIDDEN')
        ctx.check(errorOf(res).message === 'This action is unauthorized.', `${role}: forbidden message differs`)
      }
    },
  },
  {
    id: 'heatmap-api/student and admin get their own (empty) heatmap; a query is ignored; no-store',
    domain: 'heatmap',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['student', 'admin'] as const) {
        const client = await ctx.as(role)
        for (const url of [PATH, `${PATH}?userId=1`]) {
          const res = await client.request('GET', url)
          ctx.check(res.status === 200, `${role} ${url}: expected 200, got ${String(res.status)}`)
          ctx.check(JSON.stringify(dataOf(res)) === JSON.stringify({ subjects: [] }), `${role} ${url}: expected the empty state`)
          ctx.check(res.headers['cache-control']?.includes('no-store') === true, `${role}: the heatmap is cacheable`)
        }
      }
    },
  },
]
