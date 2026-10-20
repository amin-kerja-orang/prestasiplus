import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, errorOf, expectError } from '../helpers'

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

/**
 * NOT registered in `scenarios.ts`: the runner checks every response against `openapi.json`, and the two
 * facts below are outside it (a 413 is declared on no operation; `GET /health` is a NON_CONTRACT_ROUTE), so
 * they would fail as `undocumented_status` / `unknown_operation` unless the lead adds two
 * `API_KNOWN_MISMATCHES` entries with deviation rows. The same facts are asserted outside the runner in
 * `test/security/sampled-domains.spec.ts` (413) and `test/api.spec.ts` (health).
 */
export const securityInfraScenarios: Scenario[] = [
  {
    id: 'security-api/an oversized JSON body is 413 PAYLOAD_TOO_LARGE, never a 500',
    domain: 'security',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      const res = await anon.request('POST', '/auth/login', { body: { identifier: 'x'.repeat(150_000), password: 'x' } })
      expectError(ctx, res, 413, 'PAYLOAD_TOO_LARGE')
      ctx.check(typeof errorOf(res).requestId === 'string', 'the 413 carries no requestId')
      const student = await ctx.as('student')
      expectError(ctx, await student.request('POST', '/tiket', { body: { subject: 'a', body: 'y'.repeat(150_000) } }), 413, 'PAYLOAD_TOO_LARGE')
    },
  },
  {
    id: 'security-api/GET /health is public and answers 200',
    domain: 'security',
    targets: API_ONLY,
    async run(ctx) {
      const res = await ctx.anonymous().request('GET', '/health')
      ctx.expectStatus(res, 200)
    },
  },
]
