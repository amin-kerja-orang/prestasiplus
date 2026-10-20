import { GAMES_SOLO_GAMES, type GamesSoloGame } from '@pp/contract'

/**
 * Pure rules of the five single-player games (BR-M16-25/26/27, D58a). The scoring is the client formulas of
 * `src/modules/m16-battle-games/components/solo/solo-lib.ts` (the live page), now computed by the server from the
 * stored checks in `checked_seq` order. No I/O here, so it is unit-tested alone.
 */
export interface SoloInfo {
  game: GamesSoloGame
  /** M14 `onGameResult` game token (`gameRow`). */
  token: string
  /** Items per payload (pairs for kad-memori). */
  items: number
  /** How many candidate questions to request per item, because some questions do not fit the game. */
  oversample: number
}

export const SOLO_INFO: Readonly<Record<GamesSoloGame, SoloInfo>> = {
  'betul-salah': { game: 'betul-salah', token: 'betul_salah', items: 40, oversample: 1 },
  'cabaran-kilat': { game: 'cabaran-kilat', token: 'cabaran_kilat', items: 30, oversample: 3 },
  'tembak-jawapan': { game: 'tembak-jawapan', token: 'tembak_jawapan', items: 30, oversample: 3 },
  'susun-jawapan': { game: 'susun-jawapan', token: 'susun_jawapan', items: 20, oversample: 8 },
  'kad-memori': { game: 'kad-memori', token: 'kad_memori', items: 6, oversample: 1 },
}

export const isSoloGame = (game: string): game is GamesSoloGame => (GAMES_SOLO_GAMES as readonly string[]).includes(game)

/** Kad Memori: 6 pairs, 12 cards, default board 4 x 3, coins 6 on completion. */
export const MEMORY_PAIRS = 6
export const MEMORY_CARDS = 12
export const MEMORY_LAYOUT = { columns: 4, rows: 3 } as const
export const MEMORY_COINS = 6
/** Susun Jawapan keeps questions whose correct option has at most this many characters. */
export const SUSUN_MAX_ANSWER = 20
/** Darjah used when the caller has no grade. */
export const DEFAULT_DARJAH = 4

export interface Gain {
  points: number
  coins: number
}

/** Betul atau Salah: `streak` is the streak after the correct answer. */
export const betulSalahGain = (streak: number): Gain => ({ points: 10 + Math.min(streak, 10) * 2, coins: Math.min(streak, 5) })
/** Cabaran Kilat: `combo` is the combo after the correct answer. */
export const cabaranGain = (combo: number): Gain => ({ points: 10 * Math.min(combo, 10), coins: Math.min(combo, 10) })
/** Tembak Jawapan: level 1 and +1 every 5 correct answers. */
export const tembakLevel = (correct: number): number => 1 + Math.floor(correct / 5)
/** A correct tap at `level`. */
export const tembakGain = (level: number): Gain => ({ points: 10 * level, coins: level })
/** A solved puzzle worth `points`. */
export const susunGain = (points: number): Gain => ({ points, coins: Math.ceil(points / 3) })

/** Susun Jawapan points of one puzzle: letters `max(5, 2 * tiles)`, words `3 * tiles`. */
export const susunPoints = (type: 'letters' | 'words', tiles: number): number => (type === 'letters' ? Math.max(5, tiles * 2) : tiles * 3)

/** A stored check, as far as scoring needs: in `checked_seq` order. */
export interface CheckFact {
  correct: boolean
  /** Susun Jawapan: the puzzle points of the item. */
  points: number | null
}

export interface RunResult {
  score: number
  coins: number
  correct: number
  total: number
  /** Betul/Salah longest streak, Cabaran Kilat highest combo, Tembak Jawapan highest level, Susun Jawapan solved count. */
  best: number
}

/** Computes score, coins and counts of a (non Kad Memori) game from its checks. */
export function scoreRun(game: Exclude<GamesSoloGame, 'kad-memori'>, checks: readonly CheckFact[]): RunResult {
  let score = 0
  let coins = 0
  let correct = 0
  let run = 0
  let best = 0
  for (const c of checks) {
    if (!c.correct) {
      run = 0
      continue
    }
    run += 1
    let gain: Gain
    switch (game) {
      case 'betul-salah':
        gain = betulSalahGain(run)
        best = Math.max(best, run)
        break
      case 'cabaran-kilat':
        gain = cabaranGain(run)
        best = Math.max(best, run)
        break
      case 'tembak-jawapan':
        gain = tembakGain(tembakLevel(correct))
        break
      case 'susun-jawapan':
        gain = susunGain(c.points ?? 0)
        break
    }
    score += gain.points
    coins += gain.coins
    correct += 1
  }
  if (game === 'tembak-jawapan') best = tembakLevel(correct)
  if (game === 'susun-jawapan') best = correct
  return { score, coins, correct, total: checks.length, best }
}

/** Kad Memori accuracy: `round(6 / moves * 100)`. */
export const memoryAccuracy = (moves: number): number => Math.round((MEMORY_PAIRS / moves) * 100)

/** The ceiling of each score formula for `c` correct answers (the old client bounds; tests assert the server stays under them). */
const sumTo = (c: number, gain: (k: number) => number): number => {
  let s = 0
  for (let k = 1; k <= c; k++) s += gain(k)
  return s
}
export const maxBetulSalah = (c: number): number => sumTo(c, (k) => betulSalahGain(k).points)
export const maxCabaranKilat = (c: number): number => sumTo(c, (k) => cabaranGain(k).points)
export const maxTembak = (c: number): number => sumTo(c, (k) => 10 * (1 + Math.floor((k - 1) / 5)))

/** Susun Jawapan answers are compared trimmed, whitespace-collapsed and case-insensitive. */
export const normaliseAnswer = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase()

/** Jutawan Ilmu: 15 questions, 3 lifelines; difficulty ladder 1 for Q1-4, 2 for Q5-8, 3 for Q9-12, 4 for Q13-15. */
export const JUTAWAN_QUESTIONS = 15
export const JUTAWAN_LIFELINES = 3
export const jutawanDifficulty = (n: number): number => (n <= 4 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : 4)
/** Coins of the level reached: 1000 at level 15, 50 at levels 10 to 14, otherwise 0 (PROPOSED ladder). */
export const jutawanCoins = (level: number): number => (level >= 15 ? 1000 : level >= 10 ? 50 : 0)

/**
 * [PROPOSED, LEAD to confirm] Pacing guard against reward farming by a scripted client, per gap: a run earns coins (and can
 * be a personal-best record) only when EVERY check is at least this long after the previous check (the first one after the
 * session was created), by the server Clock and the stored `checked_at`. A run with a fast gap is still stored and returned,
 * `coins_computed` keeps the computed value, but nothing is credited and no reward call is made. Jutawan Ilmu: the same with
 * its own per-answer minimum. Kad Memori: per move, mismatches included.
 */
export const MIN_MS_PER_ITEM = 1000
export const JUTAWAN_MIN_MS_PER_QUESTION = 2000
/** True when `times` (in check order) has a gap shorter than `minMs`, the first measured from `start`. */
export function hasFastGap(start: Date, times: readonly Date[], minMs: number): boolean {
  let prev = start.getTime()
  for (const t of times) {
    if (t.getTime() - prev < minMs) return true
    prev = t.getTime()
  }
  return false
}
