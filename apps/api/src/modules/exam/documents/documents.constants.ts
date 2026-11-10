import type { RateLimitSpec } from '../../../common/throttle'

/** Rate limits of the Kertas Subjektif document routes (per signed-in user; environment variables are documented in .env.api.example). */
export const KERTAS_DOKUMEN_LIMITS = {
  read: { bucket: 'kertas.dokumen.read', env: 'THROTTLE_KERTAS_DOKUMEN_READ_PER_MINUTE', default: 240, per: 'user' },
  write: { bucket: 'kertas.dokumen.write', env: 'THROTTLE_KERTAS_DOKUMEN_WRITE_PER_MINUTE', default: 60, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
