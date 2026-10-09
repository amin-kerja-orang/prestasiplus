import { describe, expect, it } from 'vitest'

import {
  betulSalahGain,
  betulSalahTitle,
  cabaranGain,
  cabaranKilatTitle,
  difficultyChip,
  fallBaseSeconds,
  fallProgress,
  formatClock,
  jutawanHeading,
  missDeadlineSeconds,
  nextWheelRotation,
  parseDarjah,
  susunGain,
  susunMatches,
  susunTitle,
  tembakGain,
  tembakLevel,
  tembakTitle,
  tileFallSeconds,
  tileJitter,
  wheelLandingDeg,
  wheelTurns,
} from '../../components/solo/solo-lib'

describe('parseDarjah (FR-M16-07)', () => {
  it.each([
    ['1', 1],
    ['4', 4],
    ['11', 11],
  ])('%s is %i', (raw, expected) => {
    expect(parseDarjah(raw)).toBe(expected)
  })
  it.each([undefined, '', '0', '12', 'x', '4.5', '-1', ['3']])('%s is ignored', (raw) => {
    expect(parseDarjah(raw)).toBe(raw && Array.isArray(raw) ? 3 : null)
  })
})

describe('scoring (BR-M16-26)', () => {
  it('Betul atau Salah: six correct in a row score 102 and 20 syiling', () => {
    let score = 0
    let coins = 0
    for (let streak = 1; streak <= 6; streak++) {
      const g = betulSalahGain(streak)
      score += g.points
      coins += g.coins
    }
    expect(score).toBe(102)
    expect(coins).toBe(1 + 2 + 3 + 4 + 5 + 5)
  })

  it('Betul atau Salah caps the streak bonus at 10 and the syiling at 5', () => {
    expect(betulSalahGain(10)).toEqual({ points: 30, coins: 5 })
    expect(betulSalahGain(25)).toEqual({ points: 30, coins: 5 })
  })

  it('Cabaran Kilat: three correct in a row give 6 syiling (AC-26.4)', () => {
    const coins = [1, 2, 3].reduce((n, combo) => n + cabaranGain(combo).coins, 0)
    expect(coins).toBe(6)
    expect(cabaranGain(12)).toEqual({ points: 100, coins: 10 })
  })

  it('Tembak Jawapan: 10 × level, level +1 every 5 correct', () => {
    expect(tembakGain(3)).toEqual({ points: 30, coins: 3 })
    expect([0, 4, 5, 9, 10].map(tembakLevel)).toEqual([1, 1, 2, 2, 3])
  })

  it('Susun Jawapan: syiling = ceil(points ÷ 3)', () => {
    expect(susunGain(6)).toEqual({ points: 6, coins: 2 })
    expect(susunGain(7).coins).toBe(3)
  })
})

describe('result titles', () => {
  it('Betul atau Salah', () => {
    expect([299, 300, 150, 149, 80, 79].map(betulSalahTitle)).toEqual([
      '🔥 LUAR BIASA!',
      '🏆 LEGENDA!',
      '🔥 LUAR BIASA!',
      '✅ HEBAT!',
      '✅ HEBAT!',
      '💪 TERUSKAN!',
    ])
  })
  it('Cabaran Kilat', () => {
    expect([500, 300, 150, 149].map(cabaranKilatTitle)).toEqual([
      '🏆 LEGENDA!',
      '🔥 LUAR BIASA!',
      '⚡ PANTAS!',
      '💪 TERUSKAN!',
    ])
  })
  it('Tembak Jawapan', () => {
    expect([500, 200, 80, 79].map(tembakTitle)).toEqual([
      '🏆 SNIPER!',
      '🎯 SHARP!',
      '💪 BAGUS!',
      '🔄 CUBA LAGI!',
    ])
  })
  it('Susun Jawapan by solved ratio', () => {
    expect([18, 12, 6, 5].map((n) => susunTitle(n, 20))).toEqual([
      '🏆 GENIUS!',
      '🧩 BIJAK!',
      '💪 BAGUS!',
      '📚 TERUSKAN!',
    ])
    expect(susunTitle(0, 0)).toBe('📚 TERUSKAN!')
  })
  it('difficulty chip', () => {
    expect([1, 2, 3, 4].map((d) => difficultyChip(d).label)).toEqual([
      'Mudah',
      'Mudah',
      'Sederhana',
      'Sukar',
    ])
  })
})

describe('Tembak Jawapan timing', () => {
  it('base fall time falls 0.7 s per level to a 5 s floor', () => {
    expect(fallBaseSeconds(1)).toBe(15)
    expect(fallBaseSeconds(2)).toBeCloseTo(14.3)
    expect(fallBaseSeconds(30)).toBe(5)
  })
  it('the miss deadline is base + 6 + 2 per option', () => {
    expect(missDeadlineSeconds(1, 4)).toBe(29)
  })
  it('a tile falls 0-2 s longer than the base, deterministically', () => {
    const j = tileJitter(7, 2)
    expect(j).toBeGreaterThanOrEqual(0)
    expect(j).toBeLessThan(1)
    expect(tileJitter(7, 2)).toBe(j)
    expect(tileFallSeconds(1, 7, 2)).toBeCloseTo(15 + j * 2)
  })
  it('progress is 0 before the start, linear, and 1 after the fall', () => {
    expect(fallProgress(500, 1800, 10)).toBe(0)
    expect(fallProgress(6800, 1800, 10)).toBeCloseTo(0.5)
    expect(fallProgress(99_999, 1800, 10)).toBe(1)
  })
})

describe('Susun Jawapan check', () => {
  it('letters join without a space, words with one; trimmed, case-insensitive', () => {
    expect(susunMatches(['k', 'U', 'a'], 'letters', ' kua ')).toBe(true)
    expect(susunMatches(['Kuala', 'lumpur'], 'words', 'kuala Lumpur')).toBe(true)
    expect(susunMatches(['Kuala', 'lumpur'], 'letters', 'Kuala Lumpur')).toBe(false)
    expect(susunMatches(['a', 'b'], 'letters', 'ba')).toBe(false)
  })
})

describe('clock and headings', () => {
  it('formats m:ss', () => {
    expect([0, 4, 65, 600].map(formatClock)).toEqual(['0:00', '0:04', '1:05', '10:00'])
  })
  it('Jutawan heading', () => {
    expect(jutawanHeading(4)).toBe('DARJAH 4')
    expect(jutawanHeading(10)).toBe('TINGKATAN 4')
  })
})

describe('Roda Nasib rotation (BR-M16-29)', () => {
  it('lands at 360 − (index × 45 + 22.5)', () => {
    expect(wheelLandingDeg(0)).toBe(337.5)
    expect(wheelLandingDeg(2)).toBe(247.5)
    expect(wheelLandingDeg(7)).toBe(22.5)
  })
  it('turns 5-8 times and ends exactly on the landing angle', () => {
    for (let index = 0; index < 8; index++) {
      expect(wheelTurns(index)).toBeGreaterThanOrEqual(5)
      expect(wheelTurns(index)).toBeLessThanOrEqual(8)
      const from = index * 97.3
      const to = nextWheelRotation(from, index)
      expect(to).toBeGreaterThan(from + 5 * 360 - 1)
      expect(((to % 360) + 360) % 360).toBeCloseTo(wheelLandingDeg(index))
    }
  })
})
