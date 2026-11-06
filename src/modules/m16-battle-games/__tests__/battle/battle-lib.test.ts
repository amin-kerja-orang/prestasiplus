import { describe, expect, it } from 'vitest'

import {
  BATTLE_STATES,
  BATTLE_MSG,
  battleRelativeTime,
  canStart,
  formatMss,
  matchParams,
  mskText,
  optionLetter,
  type BattleSelection,
} from '../../components/battle/battle-lib'

const base: BattleSelection = {
  questionType: 'biasa',
  openToAll: false,
  subjectId: null,
  pkskDomainId: null,
  pkskLevel: null,
  spmSubjectId: null,
}

describe('formatMss', () => {
  it.each([
    [0, '0:00'],
    [3, '0:03'],
    [59.9, '0:59'],
    [75, '1:15'],
    [120, '2:00'],
  ])('%s s is %s', (s, text) => expect(formatMss(s)).toBe(text))
})

describe('canStart / matchParams (FN-M16-2.1.6, BR-M16-03)', () => {
  it('biasa needs a subject', () => {
    expect(canStart(base)).toBe(false)
    const sel = { ...base, subjectId: 3 }
    expect(canStart(sel)).toBe(true)
    expect(matchParams(sel)).toEqual({ question_type: 'biasa', open_to_all: false, subject_id: 3 })
  })

  it('pksk needs a domain and a level', () => {
    const pksk = { ...base, questionType: 'pksk' as const, openToAll: true }
    expect(canStart({ ...pksk, pkskDomainId: 2 })).toBe(false)
    expect(canStart({ ...pksk, pkskLevel: 'T1' })).toBe(false)
    const sel = { ...pksk, pkskDomainId: 2, pkskLevel: 'T4' as const }
    expect(canStart(sel)).toBe(true)
    expect(matchParams(sel)).toEqual({
      question_type: 'pksk',
      open_to_all: true,
      pksk_domain_id: 2,
      pksk_target_level: 'T4',
    })
  })

  it('spm needs an SPM subject and posts it as subject_id', () => {
    const spm = { ...base, questionType: 'spm' as const, subjectId: 3 }
    expect(canStart(spm)).toBe(false)
    const sel = { ...spm, spmSubjectId: 9 }
    expect(canStart(sel)).toBe(true)
    expect(matchParams(sel)).toEqual({ question_type: 'spm', open_to_all: false, subject_id: 9 })
  })

  it('the chosen count goes out as question_count for every type; no chip, no field', () => {
    expect(matchParams({ ...base, subjectId: 3, questionCount: 15 })).toEqual({
      question_type: 'biasa',
      open_to_all: false,
      subject_id: 3,
      question_count: 15,
    })
    expect(
      matchParams({
        ...base,
        questionType: 'pksk',
        pkskDomainId: 2,
        pkskLevel: 'T1',
        questionCount: 5,
      }),
    ).toMatchObject({ question_type: 'pksk', question_count: 5 })
    expect(
      matchParams({ ...base, questionType: 'spm', spmSubjectId: 9, questionCount: 20 }),
    ).toMatchObject({ question_type: 'spm', subject_id: 9, question_count: 20 })
    expect(matchParams({ ...base, subjectId: 3 })).not.toHaveProperty('question_count')
  })
})

describe('BATTLE_MSG copy (48 GAME-01)', () => {
  it('uses the exact BM of the spec', () => {
    expect(BATTLE_MSG.noOpponent).toBe('Tiada lawan dijumpai.')
    expect(BATTLE_MSG.retry).toBe('Cuba Lagi')
    expect(BATTLE_MSG.robotOverlay).toBe(
      'Tiada lawan setakat ini. Anda akan bermain dengan Robot PrestasiPlus (latihan).',
    )
    expect(BATTLE_MSG.invitationExpired).toBe('Cabaran tamat tempoh.')
    expect([
      BATTLE_MSG.resultWin,
      BATTLE_MSG.resultLose,
      BATTLE_MSG.resultDraw,
      BATTLE_MSG.resultOpponentForfeit,
      BATTLE_MSG.resultOwnForfeit,
      BATTLE_MSG.backToArena,
    ]).toEqual([
      'Anda menang!',
      'Anda kalah.',
      'Seri!',
      'Lawan menyerah. Anda menang!',
      'Anda telah menyerah.',
      'Kembali ke Arena',
    ])
  })
})

describe('battleRelativeTime (BR-M16-37)', () => {
  const now = '2026-09-25T08:00:00Z'
  it.each([
    ['2026-09-25T07:59:30Z', 'baru sahaja'],
    ['2026-09-25T07:55:00Z', '5 minit yang lepas'],
    ['2026-09-25T05:00:00Z', '3 jam yang lepas'],
    ['2026-09-22T08:00:00Z', '3 hari yang lepas'],
    ['2026-09-15T08:00:00Z', '1 minggu yang lepas'],
    ['2026-07-25T08:00:00Z', '2 bulan yang lepas'],
  ])('%s is "%s"', (iso, text) => expect(battleRelativeTime(iso, now)).toBe(text))
})

describe('misc', () => {
  it('mskText and optionLetter', () => {
    expect(mskText(5, 0, 5)).toBe('5/0/5')
    expect([0, 1, 2, 3].map(optionLetter)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('lists the 16 states of the S3 select', () => {
    expect(BATTLE_STATES).toHaveLength(16)
    expect(BATTLE_STATES[0]).toBe('Johor')
    expect(BATTLE_STATES.at(-1)).toBe('Terengganu')
  })
})
