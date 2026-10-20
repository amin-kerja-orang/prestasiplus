/**
 * D57(a): every write route documents 429 RATE_LIMITED (body ErrorBody with `retryAfter`, plus the
 * `Retry-After` header). The helper is identical to the one in the merged BE-36 `ai/rate-limit.ts`
 * (compared line by line), so it is re-exported instead of copied; the emitted OpenAPI is unchanged.
 * The shared 429 still moves to common/ (D59d); LEAD consolidation is pending.
 */
export { RATE_LIMITED_RESPONSE as INTAKE_RATE_LIMITED_RESPONSE, registerRoute as registerIntakeRoute } from '../ai/rate-limit'
