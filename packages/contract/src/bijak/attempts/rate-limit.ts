import type { OpenAPIRegistry, RouteConfig } from '@asteasolutions/zod-to-openapi'

import { ErrorBodySchema } from '../../common/error'

/**
 * D57(a): every write route (POST, PUT, PATCH, DELETE) and every lookup that can be used to
 * enumerate people documents 429 RATE_LIMITED. The body is the generic ErrorBody with `retryAfter`
 * (seconds), and the `Retry-After` header repeats the same number (BE-NFR-04). The numeric limits
 * belong to the implementation card and the runbook, not to the contract.
 */
export const RATE_LIMITED_RESPONSE = {
  description:
    'RATE_LIMITED "Terlalu banyak percubaan. Sila cuba sebentar lagi." The body carries retryAfter (seconds) and the Retry-After header carries the same value.',
  headers: {
    'Retry-After': {
      description: 'Seconds until a retry is allowed (same value as error.retryAfter).',
      schema: { type: 'integer' as const, minimum: 0 },
    },
  },
  content: { 'application/json': { schema: ErrorBodySchema } },
}

const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete'])

/**
 * Registers a route and adds the 429 response when the method is a write, or when `rateLimit` is
 * true (a lookup). A 429 already declared on the route is kept.
 */
export function registerRoute(
  registry: OpenAPIRegistry,
  route: RouteConfig,
  rateLimit: boolean = WRITE_METHODS.has(route.method),
): void {
  registry.registerPath(
    rateLimit ? { ...route, responses: { ...route.responses, 429: route.responses[429] ?? RATE_LIMITED_RESPONSE } } : route,
  )
}
