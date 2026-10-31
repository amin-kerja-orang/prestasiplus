import { QUESTION_STIMULUS_KINDS } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { COGNITIVE_OPTIONS, dskpGaps, isDskpComplete, isKbat, MAX_SP, questionTp, toggleSp } from '../../../lib/studio/dskp-tags'
import { STIMULUS_KINDS } from '../../../lib/studio/stimulus'

describe('DSKP tags per leaf (ADR-0031)', () => {
  it('the local option lists equal the contract lists (T33 six levels, T07 seven kinds)', () => {
    // QUESTION_COGNITIVE_LEVELS of r1/t33-leaf-tags (not merged yet): kept as a literal until it is.
    expect(COGNITIVE_OPTIONS.map((c) => c.value)).toEqual(['mengingat', 'memahami', 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta'])
    expect(STIMULUS_KINDS.map((k) => k.value)).toEqual([...QUESTION_STIMULUS_KINDS])
  })

  it('names every gap: unit, SP, and the TP and the level of each leaf', () => {
    const gaps = dskpGaps({ unitId: null, spIds: [], leaves: [{ label: 'a', tp: null, cognitive: null }, { label: 'b', tp: 3, cognitive: 'memahami' }] })
    expect(gaps).toEqual([
      'Soalan belum dipautkan kepada topik DSKP.',
      'Sila pilih sekurang-kurangnya satu SP DSKP.',
      'Bahagian (a) belum ada TP.',
      'Bahagian (a) belum ada aras pemikiran.',
    ])
    expect(isDskpComplete({ unitId: '5', spIds: ['9'], leaves: [{ label: 'a', tp: 2, cognitive: 'menilai' }] })).toBe(true)
  })

  it('the question TP is the highest leaf TP, null until a leaf has one', () => {
    expect(questionTp([{ tp: null }, { tp: null }])).toBeNull()
    expect(questionTp([{ tp: 2 }, { tp: null }, { tp: 5 }, { tp: 3 }])).toBe(5)
  })

  it('only the four upper levels are KBAT', () => {
    expect(isKbat(null)).toBe(false)
    expect(isKbat('mengingat')).toBe(false)
    expect(isKbat('memahami')).toBe(false)
    for (const v of ['mengaplikasi', 'menganalisis', 'menilai', 'mencipta'] as const) expect(isKbat(v)).toBe(true)
  })

  it('keeps at most three SP', () => {
    let sp: string[] = []
    for (const id of ['1', '2', '3', '4']) sp = toggleSp(sp, id)
    expect(sp).toEqual(['1', '2', '3'])
    expect(sp).toHaveLength(MAX_SP)
    expect(toggleSp(sp, '2')).toEqual(['1', '3'])
  })
})
