import { describe, expect, it } from 'vitest'

import { GAME_SETTINGS } from '../../../src/modules/games/core/game-settings.service'
import { gameReward, type GameRewardFacts } from '../../../src/modules/games/core/wallet-rewards'

const S = {
  xp_per_correct: GAME_SETTINGS.xp_per_correct.default,
  game_win_xp: GAME_SETTINGS.game_win_xp.default,
  game_draw_xp: GAME_SETTINGS.game_draw_xp.default,
  game_play_xp: GAME_SETTINGS.game_play_xp.default,
  game_win_bonus_syiling: GAME_SETTINGS.game_win_bonus_syiling.default,
}
const facts = (over: Partial<GameRewardFacts>): GameRewardFacts => ({ correct: 0, outcome: 'play', robotsOnly: false, fastGap: false, ...over })

describe('FR-GM-00.3, 48 section 3.4: the one reward formula', () => {
  it('AC-GM-00.1: a solo game with 3 correct gives 3 x 10 + the play XP', () => {
    expect(gameReward(facts({ correct: 3 }), S, 1).xp).toBe(35)
  })

  it('AC-GM-00.2: a won game with 7 correct gives 12 syiling and 90 XP', () => {
    expect(gameReward(facts({ correct: 7, outcome: 'win' }), S, 1)).toEqual({ xp: 90, coins: 12 })
  })

  it('a draw gives the draw XP and no bonus; a loss gives the play XP', () => {
    expect(gameReward(facts({ correct: 2, outcome: 'draw' }), S, 1)).toEqual({ xp: 30, coins: 2 })
    expect(gameReward(facts({ correct: 2, outcome: 'play' }), S, 1)).toEqual({ xp: 25, coins: 2 })
  })

  it('rule 3: against robots only the play XP applies and no win bonus', () => {
    for (const outcome of ['win', 'draw', 'play'] as const) {
      expect(gameReward(facts({ correct: 4, outcome, robotsOnly: true }), S, 1)).toEqual({ xp: 45, coins: 4 })
    }
  })

  it('rule 1: a forfeit gives nothing; rule 5: a fast gap credits nothing', () => {
    expect(gameReward(facts({ correct: 9, outcome: 'forfeit' }), S, 1)).toEqual({ xp: 0, coins: 0 })
    expect(gameReward(facts({ correct: 9, outcome: 'win', fastGap: true }), S, 1)).toEqual({ xp: 0, coins: 0 })
  })

  it('reads the rate it is given: a saved setting changes the next result only (FR-GM-00.10)', () => {
    expect(gameReward(facts({ correct: 3 }), { ...S, game_play_xp: 8, xp_per_correct: 20 }, 3)).toEqual({ xp: 68, coins: 9 })
  })
})
