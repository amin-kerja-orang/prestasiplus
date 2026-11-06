/**
 * S7-T04 part 17: the M14 ← M16 read behind #26 "Juara Battle", against the real M16 battle store. Only
 * `finished` battles won by the user's side count (a forfeit has its own status; a loss, an active or an
 * abandoned battle do not), and the 10th win unlocks the badge once through `onGameResult`.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { bootMock } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m07 from '@/modules/m07-pksk/mock'
import m10 from '@/modules/m10-teacher-class/mock'
import m11 from '@/modules/m11-teacher-analytics/mock'
import m16, { battles, type BattleRow } from '@/modules/m16-battle-games/mock'

import m14, { achievements, coinLedger, gamification } from '../../mock'
import { battleWins } from '../../mock/repository/reads'
import { stubStorage } from './helpers'

beforeAll(async () => {
  stubStorage()
  await bootMock({
    mode: 'test',
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
    plugins: [m01, m02, m03, m04, m05, m07, m10, m11, m14, m16],
  })
}, 120_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const USER = 3
const OTHER = 4
let seq = 0

function battle(over: Partial<BattleRow>): BattleRow {
  seq += 1
  return {
    id: `f17b0000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    mode: 'quick_match',
    questionType: 'subject',
    subjectId: null,
    pkskDomainId: null,
    pkskTargetLevel: null,
    levelId: null,
    playerA: USER,
    playerB: OTHER,
    schoolAId: null,
    schoolBId: null,
    scoreA: 100,
    scoreB: 50,
    correctA: 8,
    correctB: 4,
    answered: 10,
    winner: 'A',
    status: 'finished',
    createdAt: '2026-09-20T10:00:00+08:00',
    createdAtMs: Date.parse('2026-09-20T10:00:00+08:00'),
    finishedAt: '2026-09-20T10:05:00+08:00',
    questionIds: [],
    seeded: false,
    ...over,
  } as BattleRow
}

describe('battleWins (M14 ← M16)', () => {
  it('counts finished wins of either side; not a loss, a forfeit, an active or an abandoned battle', () => {
    const before = battleWins(USER)
    battles.seed([
      battle({}), // win as A
      battle({ playerA: OTHER, playerB: USER, winner: 'B' }), // win as B
      battle({ winner: 'B' }), // loss
      battle({ status: 'forfeited' }), // forfeit win: not counted
      battle({ status: 'active', winner: null }),
      battle({ status: 'abandoned', winner: null }),
    ])
    expect(battleWins(USER)).toBe(before + 2)
  })

  it('the 10th real win unlocks #26 once through onGameResult; the badge pays 30 syiling and is listed', () => {
    const have = battleWins(USER)
    battles.seed(Array.from({ length: 10 - have }, () => battle({})))
    expect(battleWins(USER)).toBe(10)
    gamification.onGameResult(USER, { game: 'battle', event: 'win', coins: 0, xp: 0 })
    gamification.onGameResult(USER, { game: 'battle', event: 'win', coins: 0, xp: 0 })
    const a = achievements.forUser(USER)
    expect(a.items.find((i) => i.id === 26)).toMatchObject({ unlocked: true })
    expect(
      coinLedger.forUser(USER).filter((r) => r.description === 'Pencapaian: Juara Battle'),
    ).toHaveLength(1)
  })
})
