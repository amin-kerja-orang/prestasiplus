import { describe, expect, it } from 'vitest'

import { prngStream } from '../../../src/db/prng'
import {
  betulSalahGain,
  cabaranGain,
  jutawanCoins,
  jutawanDifficulty,
  maxBetulSalah,
  maxCabaranKilat,
  maxTembak,
  memoryAccuracy,
  normaliseAnswer,
  scoreRun,
  MIN_MS_PER_ITEM,
  susunGain,
  susunPoints,
  tembakLevel,
  tooFast,
} from '../../../src/modules/games/solo/play/solo.rules'
import { shuffled } from '../../../src/modules/games/solo/play/solo-items'
import { SpinDraw } from '../../../src/modules/games/solo/spin/spin-draw'
import { segmentOf, SPIN_SEGMENTS } from '../../../src/modules/games/solo/spin/spin.rules'

const run = (flags: string) => flags.split('').map((c) => ({ correct: c === 'T', points: null }))

describe('solo scoring rules (the old client formulas, now server side)', () => {
  it('Betul/Salah: six correct in a row score 102 and 20 syiling; a wrong answer resets the streak', () => {
    expect(scoreRun('betul-salah', run('TTTTTT'))).toEqual({ score: 102, coins: 20, correct: 6, total: 6, best: 6 })
    expect(scoreRun('betul-salah', run('TTTFTT'))).toEqual({ score: 12 + 14 + 16 + 12 + 14, coins: 1 + 2 + 3 + 1 + 2, correct: 5, total: 6, best: 3 })
    expect(betulSalahGain(10)).toEqual({ points: 30, coins: 5 })
    expect(betulSalahGain(25)).toEqual({ points: 30, coins: 5 })
  })

  it('Cabaran Kilat: 10 x combo (capped at 10), coins = combo', () => {
    expect(scoreRun('cabaran-kilat', run('TTTFT'))).toEqual({ score: 10 + 20 + 30 + 10, coins: 1 + 2 + 3 + 1, correct: 4, total: 5, best: 3 })
    expect(cabaranGain(12)).toEqual({ points: 100, coins: 10 })
  })

  it('Tembak Jawapan: level 1 and +1 every 5 correct answers; 10 x level per correct tap', () => {
    expect([0, 4, 5, 9, 10].map(tembakLevel)).toEqual([1, 1, 2, 2, 3])
    expect(scoreRun('tembak-jawapan', run('TTTTTFT'))).toEqual({ score: 50 + 20, coins: 5 + 2, correct: 6, total: 7, best: 2 })
  })

  it('Susun Jawapan: the puzzle points of the correct ones, syiling = ceil(points / 3)', () => {
    const checks = [
      { correct: true, points: 6 },
      { correct: false, points: 9 },
      { correct: true, points: 7 },
    ]
    expect(scoreRun('susun-jawapan', checks)).toEqual({ score: 13, coins: 2 + 3, correct: 2, total: 3, best: 2 })
    expect(susunGain(6)).toEqual({ points: 6, coins: 2 })
    expect(susunPoints('letters', 3)).toBe(6)
    expect(susunPoints('letters', 1)).toBe(5)
    expect(susunPoints('words', 3)).toBe(9)
  })

  it('the computed score never exceeds the old client ceilings for the same number of correct answers', () => {
    for (const flags of ['TTTTTTTTTTTTTT', 'TFTFTFTTTTTT', 'FFFF', 'TTTTTFTTTTTTTT']) {
      const c = flags.split('').filter((x) => x === 'T').length
      expect(scoreRun('betul-salah', run(flags)).score).toBeLessThanOrEqual(maxBetulSalah(c))
      expect(scoreRun('cabaran-kilat', run(flags)).score).toBeLessThanOrEqual(maxCabaranKilat(c))
      expect(scoreRun('tembak-jawapan', run(flags)).score).toBeLessThanOrEqual(maxTembak(c))
      expect(scoreRun('betul-salah', run(flags)).coins).toBeLessThanOrEqual(5 * c)
      expect(scoreRun('cabaran-kilat', run(flags)).coins).toBeLessThanOrEqual(10 * c)
    }
  })

  it('Kad Memori accuracy is round(6 / moves * 100); answers compare trimmed and case-insensitive', () => {
    expect([6, 7, 12].map(memoryAccuracy)).toEqual([100, 86, 50])
    expect(normaliseAnswer('  Kuala   LUMPUR ')).toBe('kuala lumpur')
  })

  it('Jutawan ladder and coins', () => {
    expect([1, 4, 5, 8, 9, 12, 13, 15].map(jutawanDifficulty)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
    expect([0, 9, 10, 14, 15].map(jutawanCoins)).toEqual([0, 0, 50, 50, 1000])
  })
})

describe('Roda Nasib wheel', () => {
  it('has the 8 fixed segments in order with weights 25/20/15/8/3/15/10/4', () => {
    expect(SPIN_SEGMENTS.map((s) => s.label)).toEqual(['1 Syiling', '3 Syiling', '5 Syiling', '10 Syiling', '20 Syiling', 'Cuba Lagi', '2 Syiling', '7 Syiling'])
    expect(SPIN_SEGMENTS.map((s) => s.weight)).toEqual([25, 20, 15, 8, 3, 15, 10, 4])
    expect(SPIN_SEGMENTS.reduce((n, s) => n + s.weight, 0)).toBe(100)
    expect(SPIN_SEGMENTS[5]).toMatchObject({ type: 'nothing', value: 0 })
  })

  it('maps a draw in [0, 100) to the segment by cumulative weight', () => {
    expect([0, 24.99, 25, 44.99, 45, 59.99, 60, 67.99, 68, 70.99, 71, 85.99, 86, 95.99, 96, 99.99].map(segmentOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7])
  })

  it('the crypto draw follows the weights in the long run; forceNext is a one-shot seam', () => {
    const draw = new SpinDraw()
    const counts = new Array<number>(8).fill(0)
    for (let i = 0; i < 20_000; i++) counts[draw.draw()]! += 1
    SPIN_SEGMENTS.forEach((s, i) => expect(Math.abs((counts[i] as number) / 200 - s.weight)).toBeLessThan(1.5))
  })
})

describe('pacing guard and scramble', () => {
  it('tooFast compares the elapsed server time with the minimum per item', () => {
    expect(tooFast(5_999, 6, MIN_MS_PER_ITEM)).toBe(true)
    expect(tooFast(6_000, 6, MIN_MS_PER_ITEM)).toBe(false)
  })
})

describe('shuffled', () => {
  it('is a permutation drawn from the stream and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5, 6]
    const out = shuffled(input, prngStream('games:test:shuffle'))
    expect([...out].sort()).toEqual(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6])
    expect(shuffled(input, prngStream('games:test:shuffle'))).toEqual(out)
  })
})
