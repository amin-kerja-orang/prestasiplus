/**
 * How the robot of a battle answers (48 section 3.6): from the named PRNG stream `m16:battle:<battleUuid>`, so a seeded
 * test reproduces it. A robot is a seat with no user; nothing here reads a pupil. The robot answers one round at a time: it
 * "answers" `seconds` after the round opens (2..12 s, never beyond the question time).
 */
import { BATTLE_RULES, battleArenaPoints } from '@pp/contract'

import { prngStream } from '../../../db/prng'

export interface BotAnswer {
  /** Seconds used, 2..12 (`min(N, floor(2 + 10u))`). */
  seconds: number
  correct: boolean
  points: number
}

/** The answers of the opponent of `battleUuid` for rounds 1..`count` (10 by default); `accuracy` is its chance of a correct answer in [0, 1]; `questionSeconds` is N. */
export function botAnswers(battleUuid: string, accuracy: number, count: number = BATTLE_RULES.arenaQuestions, questionSeconds: number = BATTLE_RULES.questionSeconds): BotAnswer[] {
  const rng = prngStream(`m16:battle:${battleUuid}`)
  return Array.from({ length: count }, () => {
    const seconds = Math.min(questionSeconds, Math.floor(2 + 10 * rng.next()))
    const correct = rng.next() < accuracy
    return { seconds, correct, points: correct ? battleArenaPoints(seconds, questionSeconds) : 0 }
  })
}

/** The robot's answer of one round (1-based): the same stream as `botAnswers`, so round `r` here is entry `r` there. */
export function botAnswer(battleUuid: string, round: number, accuracy: number, questionSeconds: number = BATTLE_RULES.questionSeconds): BotAnswer {
  const all = botAnswers(battleUuid, accuracy, round, questionSeconds)
  return all[round - 1] as BotAnswer
}
