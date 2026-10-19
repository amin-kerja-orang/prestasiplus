import { describe, expect, it } from 'vitest'

import {
  BATTLE_STATES,
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
