import { z } from '../zod'
import { ErrorBodySchema } from '../common/error'

/**
 * HTTP-level pieces shared by the BE-05 paths (D57): the 429 response with `Retry-After`, the
 * `Cache-Control: no-store` header of personal-data responses, and the CSRF request header.
 * Not re-exported from `index.ts`.
 */

const json = (schema: z.ZodType, description: string, headers?: z.ZodObject) => ({
  description,
  content: { 'application/json': { schema } },
  ...(headers ? { headers } : {}),
})

/** 429 RATE_LIMITED: body `error.retryAfter` (seconds) and the `Retry-After` header (D57a). */
export const rateLimitedResponse = json(
  ErrorBodySchema,
  'RATE_LIMITED with `retryAfter` (seconds) and a `Retry-After` header. The limit values are set by the server (THROTTLE_*).',
  z.object({ 'Retry-After': z.string().meta({ description: 'Seconds until a retry is allowed.', example: '30' }) }),
)

/** Response headers of an operation that returns personal data or credentials (D57b, BE-NFR-40). */
export const noStoreHeaders = z.object({
  'Cache-Control': z.string().meta({ description: 'Always `no-store`.', example: 'no-store' }),
})

/** A success or error body that must not be cached. */
export const jsonNoStore = (schema: z.ZodType, description: string) => json(schema, description, noStoreHeaders)
export const jsonPlain = (schema: z.ZodType, description: string) => json(schema, description)

export const csrfHeaders = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
