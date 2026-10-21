import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, expectError } from '../helpers'

/**
 * AI service (BE-36) admin routes: status and settings round trip with the audit-logged PUT, the mock health check, usage
 * list, 422 cases, CSRF, and 401/403 for every non-Admin-Pusat role. API only: the mock has no such route.
 * The conformance environment uses the mock provider and no budget (the mock is unrestricted without a cap).
 */
export const aiScenarios: Scenario[] = [
  {
    id: 'ai-api/status, settings and health check: Admin Pusat reads, saves the cap, tests the mock provider',
    domain: 'ai',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const s = await admin.request('GET', '/ai/status')
      ctx.expectStatus(s, 200)
      const status = dataOf(s)
      ctx.check(status.provider === 'mock' && status.configured === true, 'the default provider is the configured mock')
      ctx.check(!('apiKey' in status) && !('baseUrl' in status), 'the status must not carry a credential or base URL')

      const p = await admin.request('PUT', '/ai/settings', { body: { monthlyBudgetSen: 4200, notifyAt80: true, notifyAt100: false } })
      ctx.expectStatus(p, 200)
      const saved = dataOf(p)
      ctx.check(saved.monthlyBudgetSen === 4200 && saved.notifyAt100 === false, 'the saved settings must be echoed')
      ctx.check(typeof saved.updatedAt === 'string', 'updatedAt must be set after the first PUT')
      const again = dataOf(await admin.request('GET', '/ai/status'))
      ctx.check(again.budgetSen === 4200, 'the status must show the new cap')

      const t = await admin.request('POST', '/ai/test', { body: {} })
      ctx.expectStatus(t, 200)
      ctx.check(dataOf(t).ok === true && dataOf(t).provider === 'mock', 'the mock health check must be ok')

      const u = await admin.request('GET', '/ai/usage?provider=mock&pageSize=5')
      ctx.expectStatus(u, 200)
      ctx.check(Array.isArray((u.body as { data?: unknown }).data), 'usage must be a list')
    },
  },
  {
    id: 'ai-api/validation, csrf and roles: 422, 403 CSRF_INVALID, 401 anonymous, 403 teacher, school admin, student',
    domain: 'ai',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      expectError(ctx, await admin.request('PUT', '/ai/settings', { body: { monthlyBudgetSen: -1, notifyAt80: true, notifyAt100: true } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('PUT', '/ai/settings', { body: { monthlyBudgetSen: 1, notifyAt80: true, notifyAt100: true, apiKey: 'x' } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('GET', '/ai/usage?month=2026-13'), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('POST', '/ai/test', { body: { unexpected: 1 } }), 422, 'VALIDATION_ERROR')
      const routes = [['GET', '/ai/status'], ['GET', '/ai/usage'], ['PUT', '/ai/settings'], ['POST', '/ai/test']] as const
      for (const [method, path] of routes) {
        expectError(ctx, await ctx.anonymous().request(method, path), 401, 'UNAUTHORIZED')
        for (const role of ['teacher', 'school_admin', 'student'] as const) {
          const who = await ctx.as(role)
          expectError(ctx, await who.request(method, path, { body: { monthlyBudgetSen: 1, notifyAt80: true, notifyAt100: true } }), 403, 'FORBIDDEN')
        }
      }
    },
  },
]
