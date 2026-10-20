import type { RateLimitSpec } from '../../common/throttle'

/**
 * Limiter for every Command Center route (D57), per signed-in user and counted per process. No new env var: the ceiling
 * reuses `THROTTLE_PERFORMANCE_READ_PER_MINUTE` (default 120) with its OWN bucket, so Command Center polls never drain the
 * performance reads. The client polls the live data every 10 s and the server status every 30 s (6 and 2 requests a minute).
 */
export const COMMAND_CENTER_READ = {
  bucket: 'command-center.read',
  env: 'THROTTLE_PERFORMANCE_READ_PER_MINUTE',
  default: 120,
  per: 'user',
} as const satisfies RateLimitSpec

/** Longest `period`/`code`/`filter` text read from a query (the controller caps longer ones with BoundedQueryPipe). */
export const QUERY_TEXT_MAX = 64

/** Body keys that change on every request without the data changing; left out of the ETag hash. */
export const VOLATILE_KEYS: readonly string[] = ['generatedAt']

/** Rows of the "recent" lists. */
export const FEED_LIMIT = 10
export const TOP_LIMIT = 5
