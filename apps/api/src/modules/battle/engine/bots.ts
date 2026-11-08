/**
 * Pure bot rules of the battle (BR-M16-05, BR-M16-08): who the opponent is and how it answers. Everything comes from
 * named PRNG streams, so a seeded test reproduces it: `m16:battle:<queueId>` picks the opponent,
 * `m16:battle:<battleUuid>` draws the ten answers.
 */
import { BATTLE_RULES, battleArenaPoints } from '@pp/contract'

import { type Prng, prngStream } from '../../../db/prng'
import type { BattleStudent } from '../battle.deps'

export interface BotAnswer {
  /** Seconds used, 2..12 (`min(15, floor(2 + 10u))`). */
  seconds: number
  correct: boolean
  points: number
}

/** The ten answers of the simulated opponent of `battleUuid`; `accuracy` is the platform answer accuracy in [0, 1]. */
export function botAnswers(battleUuid: string, accuracy: number): BotAnswer[] {
  const rng = prngStream(`m16:battle:${battleUuid}`)
  return Array.from({ length: BATTLE_RULES.arenaQuestions }, () => {
    const seconds = Math.min(BATTLE_RULES.questionSeconds, Math.floor(2 + 10 * rng.next()))
    const correct = rng.next() < accuracy
    return { seconds, correct, points: correct ? battleArenaPoints(seconds) : 0 }
  })
}

export interface BotOwner {
  id: string
  grade: number | null
  schoolId: string | null
}

/**
 * Picks the opponent from `candidates` (active students). Fisher-Yates over the candidate list with `rng`, then the first
 * that fits: same grade as the owner unless `openToAll` (or the owner has no grade) and, for a school battle, of
 * ANOTHER school; widened (ignore grade, then ignore school too) when nobody fits. `null` when nobody is left.
 */
export function pickBot(
  owner: BotOwner,
  mode: 'quick_match' | 'school_battle',
  openToAll: boolean,
  candidates: readonly BattleStudent[],
  rng: Prng,
): BattleStudent | null {
  const pool = candidates.filter((u) => u.id !== owner.id)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const tmp = pool[i] as BattleStudent
    pool[i] = pool[j] as BattleStudent
    pool[j] = tmp
  }
  const fits = (u: BattleStudent, grade: boolean, school: boolean): boolean =>
    (!grade || openToAll || owner.grade === null || u.grade === owner.grade) &&
    (!school || mode !== 'school_battle' || (u.schoolId !== null && u.schoolId !== owner.schoolId))
  return pool.find((u) => fits(u, true, true)) ?? pool.find((u) => fits(u, false, true)) ?? pool.find((u) => fits(u, false, false)) ?? null
}
