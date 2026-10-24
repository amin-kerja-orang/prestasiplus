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

/**
 * One boot-time warning (or undefined) for a production deploy without `PUBLIC_BASE_URL`: the class QR link, the referral and
 * profile share links and the league share text would then point at `DEFAULT_PUBLIC_BASE_URL` (localhost). The variable stays optional.
 */
export function publicBaseUrlBootWarning(env: { NODE_ENV?: unknown; PUBLIC_BASE_URL?: unknown }): string | undefined {
  if (env.NODE_ENV !== 'production') return undefined
  if (typeof env.PUBLIC_BASE_URL === 'string' && env.PUBLIC_BASE_URL.trim() !== '') return undefined
  return `PUBLIC_BASE_URL is not set, so class QR links, referral and profile share links and the league share text point at ${DEFAULT_PUBLIC_BASE_URL}. Set PUBLIC_BASE_URL to the public origin of the app.`
}
