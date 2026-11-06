import { describe, expect, it } from 'vitest'

import { bijakCodeOf, curriculumCodeOf } from '../../src/modules/bijak/papers/subject-codes'
import { generationSeed, levelScopeAllows, mytYear, referencePanels, ruleOf, sectionInstruction, sourceToWire, toComposerBlueprint } from '../../src/modules/bijak/papers/rules'

describe('papers rules', () => {
  it('maps the database source codes to the wire tags (Draf for anything unknown)', () => {
    expect(['verified', 'spec', 'draft', 'zzz'].map(sourceToWire)).toEqual(['Disahkan', 'Spec', 'Draf', 'Draf'])
  })

  it('translates curriculum subject codes to the Bijak codes and back; other codes pass through', () => {
    expect(['MATH', 'SCI', 'SEJ', 'PHY'].map(bijakCodeOf)).toEqual(['MAT', 'SN', 'SEJ', 'PHY'])
    expect(['MAT', 'SN', 'SEJ', 'PHY'].map(curriculumCodeOf)).toEqual(['MATH', 'SCI', 'SEJ', 'PHY'])
  })

  it('derives the default section instruction (mock getCover)', () => {
    expect(sectionInstruction(null, { type: 'all' }, 4)).toBe('Jawab semua soalan.')
    expect(sectionInstruction(null, { type: 'choose', n: 1 }, 2)).toBe('Jawab 1 soalan sahaja.')
    expect(sectionInstruction('Jawab satu.', { type: 'choose', n: 1 }, 2)).toBe('Jawab satu.')
    expect(ruleOf('choose', null)).toEqual({ type: 'all' })
  })

  it('keeps only valid reference panels', () => {
    expect(referencePanels([{ title: 'Rumus', items: ['a', '$b$'] }, { title: '', items: [] }, { title: 'x', items: [1] }, null, 'x'])).toEqual([{ title: 'Rumus', items: ['a', '$b$'] }])
    expect(referencePanels({ title: 'Rumus' })).toEqual([])
  })

  it('builds the composer blueprint; a section without a pool tag draws from the empty pool', () => {
    const b = toComposerBlueprint('MAT', 2, {
      code: '1449/2',
      source: 'verified',
      durationMin: 150,
      instructions: ['x'],
      referenceSheets: [],
      sections: [{ label: 'A', instruction: null, ruleType: 'choose', ruleN: 1, questionCount: 2, markBudget: null, compulsory: true, pool: null }],
    })
    expect(b).toMatchObject({ source: 'Disahkan', sections: [{ label: 'A', rule: { type: 'choose', n: 1 }, pool: '', take: 2, compulsory: true }] })
    expect(b).not.toHaveProperty('reference')
  })

  it('the generation seed is a pure function of clock, user, blueprint and count', () => {
    const at = new Date('2026-10-19T01:00:00Z')
    expect(generationSeed(at, '5', '1449/2', 0)).toBe(generationSeed(at, '5', '1449/2', 0))
    const others = [generationSeed(at, '6', '1449/2', 0), generationSeed(at, '5', '1449/1', 0), generationSeed(at, '5', '1449/2', 1), generationSeed(new Date(at.getTime() + 1), '5', '1449/2', 0)]
    for (const o of others) expect(o).not.toBe(generationSeed(at, '5', '1449/2', 0))
  })

  it('computes the year in Malaysia time', () => {
    expect(mytYear(new Date('2026-12-31T16:30:00Z'))).toBe(2027)
    expect(mytYear(new Date('2026-12-31T15:30:00Z'))).toBe(2026)
  })
})

describe('levelScopeAllows (S3-T07, AC-PA-36 clause b)', () => {
  const T3 = 9
  const T4 = 10
  const T5 = 11
  it('shows a NULL-scoped paper to every form, also to a pupil with no form', () => {
    for (const g of [1, 6, 7, T3, T4, T5, null, 0, 12]) expect(levelScopeAllows(null, g)).toBe(true)
  })
  it('shows t4 and t4_t5 to a T4 pupil, t5 and t4_t5 to a T5 pupil', () => {
    expect(['t4', 't5', 't4_t5'].map((s) => levelScopeAllows(s, T4))).toEqual([true, false, true])
    expect(['t4', 't5', 't4_t5'].map((s) => levelScopeAllows(s, T5))).toEqual([false, true, true])
  })
  it('shows a T1 to T3 or primary pupil, or one with no resolvable form, the NULL-scoped papers only', () => {
    for (const g of [1, 6, 7, 8, T3, null, 0, 12]) expect(['t4', 't5', 't4_t5'].map((s) => levelScopeAllows(s, g))).toEqual([false, false, false])
  })
})
