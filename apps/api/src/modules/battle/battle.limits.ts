import type { RateLimitSpec } from '../../common/throttle'

/**
 * D57 limits of the battle routes (packages/contract/src/battle/rate-limit.ts: every write, and the lookups that can
 * enumerate people, document 429). Per user; the ceilings come from the environment (`.env.api.example`, block PC-7).
 */
export const BATTLE_LIMITS = {
  read: { bucket: 'battle.read', env: 'THROTTLE_BATTLE_READ_PER_MINUTE', default: 120, per: 'user' },
  write: { bucket: 'battle.write', env: 'THROTTLE_BATTLE_WRITE_PER_MINUTE', default: 60, per: 'user' },
  poll: { bucket: 'battle.poll', env: 'THROTTLE_BATTLE_POLL_PER_MINUTE', default: 60, per: 'user' },
  search: { bucket: 'battle.search', env: 'THROTTLE_BATTLE_SEARCH_PER_MINUTE', default: 30, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>
