import type { RateLimitSpec } from '../../common/throttle'

/**
 * Rate limits of the games module (D57a/D57b), all per signed-in user, fixed 60 s window. The ceiling is read
 * from the env var (a positive integer), else `default`. Every write route and the solo GET (it creates a
 * session row) carries one. A refused request (401/403/CSRF) is not counted.
 * - write:      room create/join/start/action, leagues create/join, quick-match start/poll/cancel, Jutawan, admin PUT
 * - read:       hub, lobby, room poll (every 3 s), league lists, boards, admin GET
 * - spin:       Roda Nasib spin (one a day; the limit only blunts hammering)
 * - soloStart:  GET /games/solo/:game (creates a session)
 * - soloCheck:  solo check / reveal / submit (a quiz posts a check per item, so the ceiling is generous)
 */
export const GAMES_LIMITS = {
  write: { bucket: 'games.write', env: 'THROTTLE_GAMES_WRITE_PER_MINUTE', default: 60, per: 'user' },
  read: { bucket: 'games.read', env: 'THROTTLE_GAMES_READ_PER_MINUTE', default: 240, per: 'user' },
  spin: { bucket: 'games.spin', env: 'THROTTLE_GAMES_SPIN_PER_MINUTE', default: 10, per: 'user' },
  soloStart: { bucket: 'games.solo.start', env: 'THROTTLE_GAMES_SOLO_START_PER_MINUTE', default: 30, per: 'user' },
  soloCheck: { bucket: 'games.solo.check', env: 'THROTTLE_GAMES_SOLO_CHECK_PER_MINUTE', default: 600, per: 'user' },
} as const satisfies Record<string, RateLimitSpec>

/** M14 game tokens (as BE-23 `gameRow` expects them) by room game. */
export const GAME_TOKENS = {
  'papan-bijak': 'papan_bijak',
  'perang-fakta': 'perang_fakta',
  'benteng-ilmu': 'benteng_ilmu',
  'perlumbaan-matematik': 'mathrace',
  'kuiz-relay': 'kuiz_relay',
  'teka-silang-kata': 'teka_silang_kata',
} as const

/** Bot answer accuracy when the platform has no figure (the mock's `botAccuracy` falls back to 0 with no answers). */
export const BOT_ACCURACY_FALLBACK = 0

/** Default of `game_settings.boardgame_quiz_tiles` (mock SEED_QUIZ_TILES); max is 38. */
export const DEFAULT_QUIZ_TILES = 35
export const MAX_QUIZ_TILES = 38
