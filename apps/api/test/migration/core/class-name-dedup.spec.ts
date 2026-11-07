/** S6-T14 (0203): `uniqueClassNames` renames a clash like the migration's data step; first wins, suffix skips taken names, re-run is stable. */
import { describe, expect, it } from 'vitest'

import { classNameKey, uniqueClassNames } from '../../../src/migration/load/class-steps'

const item = (legacyId: string, name: string, teacher: string | null = '7', year = 2026, kind: 'classroom' | 'school_class' = 'classroom') => ({
  legacyId,
  values: { kind, name, teacher_id: teacher, academic_year: year },
})
const names = (r: { items: { values: { name: string } }[] }) => r.items.map((i) => i.values.name)

describe('uniqueClassNames', () => {
  it('keeps the first of a case and edge-space variant pair and suffixes the later ones in order', () => {
    const r = uniqueClassNames([item('1', '5 Bestari'), item('2', '5 bestari'), item('3', ' 5 BESTARI ')], new Map())
    expect(names(r)).toEqual(['5 Bestari', '5 bestari (2)', '5 BESTARI (3)'])
    expect(r.renamed).toBe(2)
  })

  it('treats another teacher, another year and a school class as separate scopes', () => {
    const r = uniqueClassNames([item('1', '5 A'), item('2', '5 a', '8'), item('3', '5 a', '7', 2025), item('4', '5 a', null, 2026, 'school_class'), item('5', '5 a', '7', 2026, 'school_class')], new Map())
    expect(names(r)).toEqual(['5 A', '5 a', '5 a', '5 a', '5 a'])
    expect(r.renamed).toBe(0)
  })

  it('skips a suffix held by another row of the database', () => {
    const r = uniqueClassNames([item('1', '5 A'), item('2', '5 a')], new Map([['7|2026', new Set([classNameKey('5 A'), classNameKey('5 a (2)')])]]))
    expect(names(r)).toEqual(['5 A (3)', '5 a (4)'])
    expect(r.renamed).toBe(2)
  })

  it('is stable on a re-run and cuts the base to the 255 character name check', () => {
    const batch = [item('1', '5 A'), item('2', '5 a')]
    expect(names(uniqueClassNames(batch, new Map()))).toEqual(names(uniqueClassNames(batch, new Map())))
    const long = 'x'.repeat(255)
    const r = uniqueClassNames([item('1', long), item('2', long.toUpperCase())], new Map())
    expect(r.items[1]?.values.name).toHaveLength(255)
    expect(r.items[1]?.values.name.endsWith(' (2)')).toBe(true)
  })
})
