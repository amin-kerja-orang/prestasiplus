import type { ConfigService } from '@nestjs/config'

import type { Env } from './env.schema'

/** The public origin used outside production when `PUBLIC_BASE_URL` is not set. */
export const DEFAULT_PUBLIC_BASE_URL = 'http://localhost:8080'

/**
 * The public origin of the app (`PUBLIC_BASE_URL`, no trailing slash) that server-built links point to: the class
 * QR join link, the M14 referral and profile share links, the league share text. Falls back to
 * `DEFAULT_PUBLIC_BASE_URL` when the variable is not set.
 */
export function publicBaseUrl(config: Pick<ConfigService<Env, true>, 'get'>): string {
  return (config.get('PUBLIC_BASE_URL', { infer: true }) ?? DEFAULT_PUBLIC_BASE_URL).replace(/\/+$/, '')
}
