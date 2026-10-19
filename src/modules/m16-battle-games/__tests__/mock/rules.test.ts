/**
 * M16 pure rules (SRS M16 v1.6 BR-M16-07, BR-M16-10, BR-M16-33, BR-M16-35): the winner and the arena
 * points, the seed correct count, the league share link, the Sekolah Bersaing week and the tournament
 * and league body parsers. No boot.
 */

import { describe, expect, it } from 'vitest'

import { fromMytParts } from '@/lib/time'

import {
  arenaPoints,
  gradeLabel,
  seedCorrect,
  sideSkor,
  winnerOf,
} from '../../mock/repository/common'
import { parseLeagueBody, shareUrl } from '../../mock/repository/leagues'
import { weekStartOf } from '../../mock/repository/sekolah-bersaing'
import { parseTournamentBody } from '../../mock/repository/tournaments'
import { OBSERVED_BATTLES } from '../../mock/data/battles-observed'

describe('winner (BR-M16-07, DV-M16-35)', () => {
  it('higher score wins; equal non-zero is seri; 0-0 is player B', () => {
    expect(winnerOf(9445, 9763)).toBe('B')
    expect(winnerOf(883, 0)).toBe('A')
    expect(winnerOf(8830, 8830)).toBeNull()
    expect(winnerOf(0, 0)).toBe('B')
  })

  it('reproduces every observed winner of the 47 rows (10 are 0-0 wins for B, one seri)', () => {
    const winners = OBSERVED_BATTLES.map(([, , , , a, b]) => winnerOf(a, b))
    expect(winners.filter((w) => w === null)).toHaveLength(1)
    expect(OBSERVED_BATTLES.filter(([, , , , a, b]) => a === 0 && b === 0)).toHaveLength(10)
    expect(OBSERVED_BATTLES).toHaveLength(47)
  })
})

describe('arena points (BR-M16-07)', () => {
  it('1000 - round(500 s / 15), s = whole seconds 0-15', () => {
    expect(arenaPoints(0)).toBe(1000)
    expect(arenaPoints(3)).toBe(900)
    expect(arenaPoints(3.9)).toBe(900)
    expect(arenaPoints(7)).toBe(767)
    expect(arenaPoints(15)).toBe(500)
    expect(arenaPoints(99)).toBe(500)
    expect(arenaPoints(-4)).toBe(1000)
  })

  it('seed correct = floor(score / 500) capped at 10; skor = round(score / 100)', () => {
    expect(seedCorrect(883)).toBe(1)
    expect(seedCorrect(9780)).toBe(10)
    expect(seedCorrect(99_999)).toBe(10)
    expect(sideSkor(9445)).toBe(94)
    expect(sideSkor(950)).toBe(10)
  })

  it('grade labels (BR-M16-02)', () => {
    expect([1, 6, 7, 11].map(gradeLabel)).toEqual([
      'Darjah 1',
      'Darjah 6',
      'Tingkatan 1',
      'Tingkatan 5',
    ])
    expect(gradeLabel(null)).toBe('')
  })
})

describe('league share link (FN-M16-9.3.2)', () => {
  it('uses + for spaces and %21 for "!" as live', () => {
    expect(shareUrl('Liga Matematik Sprint Test', 'TEST2026')).toBe(
      'https://wa.me/?text=Jom+sertai+Liga+Pertandingan+%22Liga+Matematik+Sprint+Test%22+di+PrestasiPlus%21+Kod+Jemputan%3A+TEST2026+%E2%80%94+prestasiplus.my%2Fliga+%F0%9F%8F%86',
    )
  })
})

describe('Sekolah Bersaing week (BR-M16-35, DV-M16-30)', () => {
  const now = fromMytParts({ year: 2026, month: 9, day: 25, hour: 15, minute: 40 })

  it('a valid date gives the Monday of its week; the default is the current week', () => {
    expect(weekStartOf(undefined, now)).toBe('2026-09-21')
    expect(weekStartOf('2026-09-27', now)).toBe('2026-09-21')
    expect(weekStartOf('2026-09-28', now)).toBe('2026-09-28')
    expect(weekStartOf('2025-01-06', now)).toBe('2025-01-06')
    expect(weekStartOf('2025-01-08', now)).toBe('2025-01-06')
  })

  it('an invalid value is ignored', () => {
    for (const bad of ['', 'abc', '2026-02-30', '2026-13-01', '26-09-14', 20260914, null]) {
      expect(weekStartOf(bad, now), String(bad)).toBe('2026-09-21')
    }
  })
})

describe('tournament body (V-M16-07…12)', () => {
  const valid = {
    title: ' Kejohanan ',
    education_level_id: 'tingkatan4',
    format: 'single_match',
    question_mode: 'random_mix',
    mixed_subject_ids: [1, 3, 999],
    total_questions: '40',
    time_window_minutes: 60,
    top_n_scoring: 20,
    min_participants: 10,
    action: 'draft',
  }

  it('every failing field is reported; the title is trimmed and valid fields are not reported', () => {
    expect(() => parseTournamentBody({})).toThrow()
    try {
      // (Subjects need the M03 store: the endpoint tests cover the question-source rules.)
      parseTournamentBody({ ...valid, format: 'league', groups_count: 1, total_questions: 4 })
      expect.unreachable()
    } catch (e) {
      const fields = (e as { fields: Record<string, string> }).fields
      expect(fields).toMatchObject({
        groups_count: 'Bilangan kumpulan mesti antara 2 dan 8.',
        total_questions: 'Nilai di luar julat.',
      })
      expect(Object.keys(fields)).not.toContain('title')
      expect(Object.keys(fields)).not.toContain('time_window_minutes')
    }
  })
})

describe('league body (V-M16-14/15)', () => {
  const valid = {
    name: 'Liga Baru',
    type: 'friendly',
    scope: 'school',
    game_mode: 'mixed',
    scoring_method: 'wins',
    start_date: '2026-10-01',
    end_date: '2026-10-01',
    class_levels: ['T5', 'D1', 'T5'],
    max_schools: '',
  }

  it('parses the form: levels in D1…T5 order, an empty limit is no limit, equal dates are fine', () => {
    expect(parseLeagueBody(valid)).toMatchObject({
      classLevels: ['D1', 'T5'],
      maxSchools: null,
      subjectId: null,
    })
  })

  it('refuses an end date before the start and an unknown level', () => {
    expect(() => parseLeagueBody({ ...valid, end_date: '2026-09-30' })).toThrow()
    expect(() => parseLeagueBody({ ...valid, class_levels: ['X9'] })).toThrow()
    expect(() => parseLeagueBody({ ...valid, scoring_method: 'x' })).toThrow()
  })
})
