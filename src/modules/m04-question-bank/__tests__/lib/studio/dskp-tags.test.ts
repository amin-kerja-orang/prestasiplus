import { STUDIO_COGNITIVE_LEVELS, STUDIO_STIMULUS_KINDS, STUDIO_STIMULUS_KIND_LABELS } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { COGNITIVE_OPTIONS, dskpGaps, isDskpComplete, isKbat, MAX_SP, questionTp, toggleSp } from '../../../lib/studio/dskp-tags'
import { STIMULUS_KINDS } from '../../../lib/studio/stimulus'

describe('DSKP tags per leaf (ADR-0031)', () => {
  it('the local option lists equal the contract lists', () => {
    expect(COGNITIVE_OPTIONS.map((c) => [c.value, c.label, c.kbat])).toEqual(STUDIO_COGNITIVE_LEVELS.map((c) => [c.value, c.label, c.kbat]))
    expect(STIMULUS_KINDS.map((k) => k.value)).toEqual([...STUDIO_STIMULUS_KINDS])
    expect(STIMULUS_KINDS.map((k) => k.label)).toEqual(STUDIO_STIMULUS_KINDS.map((k) => STUDIO_STIMULUS_KIND_LABELS[k]))
  })

  it('names every gap: unit, SP, and the TP and the level of each leaf', () => {
    const gaps = dskpGaps({ unitId: null, spIds: [], leaves: [{ label: 'a', tp: null, cognitive: null }, { label: 'b', tp: 3, cognitive: 'bukan' }] })
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
    expect(isKbat('bukan')).toBe(false)
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
