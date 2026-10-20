import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, expectError } from '../helpers'

/**
 * Intake dashboard (BE-40) scenarios: both read models parse against the contract on the conformance database (where the
 * BE-36/BE-38 stores may not exist yet, so the figures can be the empty aggregate), the 422 cases, and 401/403 for every
 * non-Admin-Pusat role. API only: the mock has no such route (catalogue OQ-API-B2-29).
 */
export const intakeDashboardScenarios: Scenario[] = [
  {
    id: 'intake-dashboard-api/dashboard and cost: Admin Pusat reads both, month window in Malaysia time, no-store',
    domain: 'intake-dashboard',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const d = await admin.request('GET', '/intake/dashboard?month=2026-10')
      ctx.expectStatus(d, 200)
      const dash = dataOf(d)
      ctx.check(dash.month === '2026-10', 'the dashboard must answer the asked month')
      ctx.check(dash.from === '2026-10-01T00:00:00.000+08:00', 'the month must start at 00:00 +08:00')
      const byStatus = (dash.submissions as { byStatus?: unknown[] } | undefined)?.byStatus
      ctx.check(Array.isArray(byStatus) && byStatus.length === 5, 'every submission status must be listed')

      const c = await admin.request('GET', '/intake/dashboard/cost?month=2026-09&provider=mock')
      ctx.expectStatus(c, 200)
      const cost = dataOf(c)
      ctx.check(cost.provider === 'mock', 'the provider filter must be echoed')
      ctx.check(Array.isArray(cost.byDay) && cost.byDay.length === 30, 'September must list 30 days')
      ctx.check((cost.total as { costSen?: number } | undefined)?.costSen === 0, 'mock usage costs 0')
    },
  },
  {
    id: 'intake-dashboard-api/validation and roles: 422 bad month or provider, 401 anonymous, 403 teacher, school admin, student',
    domain: 'intake-dashboard',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      expectError(ctx, await admin.request('GET', '/intake/dashboard?month=2026-13'), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('GET', '/intake/dashboard/cost?provider=unknown'), 422, 'VALIDATION_ERROR')
      for (const path of ['/intake/dashboard', '/intake/dashboard/cost']) {
        expectError(ctx, await ctx.anonymous().request('GET', path), 401, 'UNAUTHORIZED')
        for (const role of ['teacher', 'school_admin', 'student'] as const) {
          const who = await ctx.as(role)
          expectError(ctx, await who.request('GET', path), 403, 'FORBIDDEN')
        }
      }
    },
  },
]
