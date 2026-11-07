/**
 * Room rules (SRS M16 BR-M16-19/20, PROVISIONAL; copied from the mock `data/games.ts`). Pure constants.
 */
export const BOARD_SIZE = 50
export const BOARD_FIXED = { ladders: 3, snakes: 3, bonus: 2, traps: 2 } as const
/** Start, finish and the 8 fixed special tiles. Plain tiles = max(0, 48 - 10 - quiz tiles). */
export const BOARD_NON_PLAIN = 10
export const BOARD_STEP = 3

export const PF_ROUNDS = 15
/** Server clocks (BR-M16-20): a Perang Fakta round lasts 10 s, a Teka Silang Kata game 5 minutes. */
export const PF_ROUND_MS = 10_000
export const CROSSWORD_MS = 300_000
export const KR_ROUNDS = 10
export const BENTENG_HP = 100
export const BENTENG_DAMAGE = 20
export const MATHRACE_STEPS = 20
/** Papan Bijak: 200 rounds with nobody on tile 50 end the game (48 GAME-02). */
export const PB_MAX_ROUNDS = 200
/** Server clocks of 48 GAME-02, GAME-04, GAME-05 and GAME-06. */
export const PB_ROLL_MS = 30_000
export const PB_ANSWER_MS = 20_000
export const BENTENG_ROUND_MS = 15_000
export const MATHRACE_ANSWER_MS = 20_000
export const RELAY_ANSWER_MS = 15_000
export const CROSSWORD_WORDS = 8

/** Pool sizes drawn at start per game. */
export const POOL_SIZE = {
  'papan-bijak': 40,
  'perang-fakta': PF_ROUNDS,
  'benteng-ilmu': 30,
  'perlumbaan-matematik': 40,
  'kuiz-relay': KR_ROUNDS,
  'teka-silang-kata': CROSSWORD_WORDS,
} as const
