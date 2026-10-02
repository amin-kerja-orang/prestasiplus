/**
 * M16 test hooks (`window.__mock`, dev and e2e builds; SRS M16 v1.6 §6.14). The M16-T1 hooks:
 *
 * | Hook | Effect |
 * |---|---|
 * | `battleSim({mode, afterPolls?})` | the NEXT battle queue: `match` (default, 3rd poll), `incoming` (challenge on the 2nd), `never`, `expired`, `not_found`, `error:<status>` (every poll answers that HTTP status) |
 * | `battleWaiting({targetUserId, outcome, viewerId?})` | DV-M16-06: a waiting queue of `targetUserId` with a join request of `viewerId` (default 1) whose decision is `matched`, `rejected` or `expired`; returns `{queueId}` |
 * | `m16Fixture(name, options?)` | `tournaments`, `invitation` (`{viewerId?}`, default 1), `anonymousSchool` (`{week?, rank?}`) — the §6.11.7 fixtures of M16-T1 |
 * | `setBattleScores(uuid, {a, b})` | sets the scores of a battle |
 * | `m16Standings()` | the standings of every period, for assertions |
 * | `resetM16()` | forgets the pending `battleSim` |
 *
 * `battleSim` mode `network` is not a hook: use the mock core's `networkErrorNext('/api/battle/poll-match/*')`.
 * `pbQuickMatch`, `roomBots`, `spinNext` and the game fixtures belong to M16-T2. Each hook validates its input.
 */

import {
  battleStandingsRepo,
  battlesRepo,
  PERIODS,
  setPendingSim,
  sekolahBersaingRepo,
  tournamentsRepo,
} from '../repository'
import type { SimSpec } from '../types'

const FIXTURES = ['tournaments', 'invitation', 'anonymousSchool'] as const

export function battleSim(opts: { mode: string; afterPolls?: number }): void {
  if (typeof opts !== 'object' || opts === null || typeof opts.mode !== 'string') {
    throw new TypeError('battleSim: expected {mode}')
  }
  const err = /^error:(\d{3})$/.exec(opts.mode)
  let spec: SimSpec
  if (err) spec = { mode: 'error', status: Number(err[1]) }
  else if (['match', 'incoming', 'never', 'expired', 'not_found'].includes(opts.mode)) {
    spec = { mode: opts.mode as SimSpec['mode'] }
  } else if (opts.mode === 'network') {
    throw new RangeError(
      "battleSim: use networkErrorNext('/api/battle/poll-match/*') for a network failure",
    )
  } else throw new RangeError(`battleSim: unknown mode '${opts.mode}'`)
  if (opts.afterPolls !== undefined) {
    if (!Number.isInteger(opts.afterPolls) || opts.afterPolls < 1) {
      throw new RangeError('battleSim: afterPolls must be a positive integer')
    }
    spec.afterPolls = opts.afterPolls
  }
  setPendingSim(spec)
}

export function battleWaiting(opts: {
  targetUserId: number
  outcome: 'matched' | 'rejected' | 'expired'
  viewerId?: number
}): { queueId: number } {
  if (!Number.isInteger(opts?.targetUserId))
    throw new TypeError('battleWaiting: targetUserId must be an integer')
  if (!['matched', 'rejected', 'expired'].includes(opts.outcome)) {
    throw new RangeError("battleWaiting: outcome must be 'matched', 'rejected' or 'expired'")
  }
  return {
    queueId: battlesRepo.insertWaitingQueue(opts.targetUserId, opts.viewerId ?? 1, opts.outcome),
  }
}

export function m16Fixture(
  name: string,
  options: { viewerId?: number; week?: string; rank?: number } = {},
): void {
  if (!(FIXTURES as readonly string[]).includes(name)) {
    throw new RangeError(`m16Fixture: unknown fixture '${name}' (M16-T1: ${FIXTURES.join(', ')})`)
  }
  if (name === 'tournaments') tournamentsRepo.insertFixtures(1)
  else if (name === 'invitation') {
    battlesRepo.insertInvitation(4301, options.viewerId ?? 1, {
      questionType: 'biasa',
      subjectId: 3,
      pkskDomainId: null,
      pkskTargetLevel: null,
      openToAll: false,
    })
  } else sekolahBersaingRepo.markAnonymous(options.week ?? '2026-09-21', options.rank ?? 1)
}

export function setBattleScores(uuid: string, scores: { a: number; b: number }): void {
  if (typeof uuid !== 'string' || !Number.isInteger(scores?.a) || !Number.isInteger(scores?.b)) {
    throw new TypeError('setBattleScores: expected (uuid, {a, b}) with integer scores')
  }
  battlesRepo.setScores(uuid, scores)
}

export function m16Standings() {
  return {
    students: Object.fromEntries(PERIODS.map((p) => [p, battleStandingsRepo.students(p)])),
    schools: Object.fromEntries(PERIODS.map((p) => [p, battleStandingsRepo.schools(p)])),
  }
}

export function resetM16(): void {
  setPendingSim(null)
}

export const m16Hooks = {
  battleSim,
  battleWaiting,
  m16Fixture,
  setBattleScores,
  m16Standings,
  resetM16,
}
