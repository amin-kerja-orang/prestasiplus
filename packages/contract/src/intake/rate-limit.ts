import type { OpenAPIRegistry, RouteConfig } from '@asteasolutions/zod-to-openapi'

import { ErrorBodySchema } from '../common/error'

/**
 * D57(a): every write route (POST, PUT, PATCH, DELETE) documents 429 RATE_LIMITED. The body is the
 * generic ErrorBody with `retryAfter` (seconds), and the `Retry-After` header repeats the same number
 * (BE-NFR-04). The numeric limits belong to the implementation card and the runbook, not to the
 * contract. Local copy: the shared 429 moves to common/ (D59d), and BE-36 and BE-39 carry the same
 * helper; the LEAD consolidates after merge (deviation row).
 */
export const INTAKE_RATE_LIMITED_RESPONSE = {
  description:
    'RATE_LIMITED "Terlalu banyak percubaan. Sila cuba sebentar lagi." [PROPOSED] (the shared 429 moves to common/, D59d). The body carries retryAfter (seconds) and the Retry-After header carries the same value.',
  headers: {
    'Retry-After': {
      description: 'Seconds until a retry is allowed (same value as error.retryAfter).',
      schema: { type: 'integer' as const, minimum: 0 },
    },
  },
  content: { 'application/json': { schema: ErrorBodySchema } },
}

const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete'])

/** Registers a route and adds the 429 response when the method is a write. A 429 already declared is kept. */
export function registerIntakeRoute(registry: OpenAPIRegistry, route: RouteConfig): void {
  registry.registerPath(
    WRITE_METHODS.has(route.method)
      ? { ...route, responses: { ...route.responses, 429: route.responses[429] ?? INTAKE_RATE_LIMITED_RESPONSE } }
      : route,
  )
}
