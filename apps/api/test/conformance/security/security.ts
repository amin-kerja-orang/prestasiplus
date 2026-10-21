import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, expectError } from '../helpers'

/**
 * Security hardening (BE-33) conformance scenarios: the cross-cutting rules every route group relies on.
 * API target only (a cookie session with CSRF). The deeper per-AC evidence lives in `test/security/`.
 */
export const securityScenarios: Scenario[] = [
  {
    id: 'security-api/a mutating request without the CSRF token is 403 CSRF_INVALID; with a wrong token too',
    domain: 'security',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['student', 'teacher', 'admin'] as const) {
        const noCsrf = await ctx.as(role, { csrf: false })
        expectError(ctx, await noCsrf.request('POST', '/tiket', { body: { subject: 'a', body: 'b' } }), 403, 'CSRF_INVALID')
        expectError(ctx, await noCsrf.request('POST', '/session/role', { body: { role } }), 403, 'CSRF_INVALID')
        const wrong = await noCsrf.request('POST', '/tiket', { headers: { 'x-csrf-token': 'bukan-token-yang-sah' }, body: { subject: 'a', body: 'b' } })
        expectError(ctx, wrong, 403, 'CSRF_INVALID')
      }
    },
  },
  {
    id: 'security-api/a protected route without a session is 401 UNAUTHORIZED',
    domain: 'security',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', '/session'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/admin/users'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', '/tiket', { body: { subject: 'a', body: 'b' } }), 401, 'UNAUTHORIZED')
    },
  },
]

// 413 and `GET /health` stay outside the runner (a 413 is declared on no operation; `/health` is a
// NON_CONTRACT_ROUTE): asserted in `test/security/sampled-domains.spec.ts` (413) and `test/api.spec.ts` (health).
