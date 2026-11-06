/**
 * How the robot of a battle answers (48 section 3.6): from the named PRNG stream `m16:battle:<battleUuid>`, so a seeded
 * test reproduces it. A robot is a seat with no user; nothing here reads a pupil.
 */
import { BATTLE_RULES, battleArenaPoints } from '@pp/contract'

import { prngStream } from '../../../db/prng'

export interface BotAnswer {
  /** Seconds used, 2..12 (`min(15, floor(2 + 10u))`). */
  seconds: number
  correct: boolean
  points: number
}

/** The ten answers of the opponent of `battleUuid`; `accuracy` is its chance of a correct answer in [0, 1]. */
export function botAnswers(battleUuid: string, accuracy: number): BotAnswer[] {
  const rng = prngStream(`m16:battle:${battleUuid}`)
  return Array.from({ length: BATTLE_RULES.arenaQuestions }, () => {
    const seconds = Math.min(BATTLE_RULES.questionSeconds, Math.floor(2 + 10 * rng.next()))
    const correct = rng.next() < accuracy
    return { seconds, correct, points: correct ? battleArenaPoints(seconds) : 0 }
  })
}
