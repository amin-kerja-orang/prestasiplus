import { BIJAK_BUILDER_CHECK_LINES as LINES } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import type { Violation } from '../../src/modules/exam/builder/exam-core.adapter'
import { checkPaper, normalizeUnits, reorderUnits } from '../../src/modules/exam/builder/paper-check'
import { violationLines } from '../../src/modules/exam/builder/standard'

const GROUPS: Record<string, string[]> = { G: ['g1', 'g2'], H: ['h1', 'h2', 'h3'] }
const groupOf = (id: string): string | undefined => Object.entries(GROUPS).find(([, m]) => m.includes(id))?.[0]
const membersOf = (g: string): string[] => GROUPS[g] ?? []

describe('D90 pure unit rules', () => {
  it('normalizeUnits: a lone member brings the whole group, in group order, at its first position', () => {
    expect(normalizeUnits(['a', 'g2', 'b'], groupOf, membersOf)).toEqual(['a', 'g1', 'g2', 'b'])
    expect(normalizeUnits(['g2', 'a', 'g1'], groupOf, membersOf)).toEqual(['g1', 'g2', 'a'])
    expect(normalizeUnits(['h3', 'a', 'h1'], groupOf, membersOf)).toEqual(['h1', 'h2', 'h3', 'a'])
  })

  it('reorderUnits moves whole units; refuses a list that is not a permutation of the units', () => {
    const ids = ['a', 'g1', 'g2', 'b']
    expect(reorderUnits(ids, ['b', 'g2', 'a'], groupOf)).toEqual(['b', 'g1', 'g2', 'a'])
    expect(reorderUnits(ids, ['a', 'b'], groupOf)).toBeNull()
    expect(reorderUnits(ids, ['a', 'g1', 'g2', 'b'], groupOf)).toBeNull() // g1 and g2 are the same unit
    expect(reorderUnits(ids, ['a', 'b', 'x'], groupOf)).toBeNull()
  })

  it('checkPaper flags a group that is out of order, split or incomplete', () => {
    const base = {
      specs: [{ label: 'A', markBudget: 3, questionCount: 3, rule: { type: 'all' as const } }],
      marksOf: () => 1,
      groupOf,
      membersOf,
      isLive: () => true,
    }
    const wrong = checkPaper({ ...base, sections: [{ questionIds: ['g2', 'g1', 'a'] }] })
    expect(wrong.sections[0]!.errors).toEqual([LINES.groupOutOfOrder('G')])
    const ok = checkPaper({ ...base, sections: [{ questionIds: ['g1', 'g2', 'a'] }] })
    expect(ok.ok).toBe(true)
    const split = checkPaper({ ...base, sections: [{ questionIds: ['g1', 'a', 'g2'] }] })
    expect(split.sections[0]!.errors).toContain(LINES.groupNotConsecutive('G'))
  })
})

describe('violationLines (D78 O-2)', () => {
  const label = (n: number) => `Bahagian ${String(n)}`
  const v = (x: Partial<Violation> & Pick<Violation, 'code' | 'tier'>): Violation => ({ sectionPosition: 1, ...x })

  it('quota, profile and KBAT findings are notes and never blockers', () => {
    const r = violationLines(
      [
        v({ code: 'QUOTA', tier: 'standard', expected: 2, actual: 1 }),
        v({ code: 'TP_COUNT', tier: 'standard' }),
        v({ code: 'KBAT', tier: 'standard', expected: 4, actual: 2 }),
        v({ code: 'INELIGIBLE', tier: 'standard', questionId: '5', detail: 'unit_not_in_quota' }),
      ],
      label,
    )
    expect(r.blockers).toEqual([])
    expect(r.notes).toHaveLength(4)
  })

  it('an untagged / keyless question and a broken group block; a pool mismatch only notes', () => {
    const r = violationLines(
      [
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '7', detail: 'no_key' }),
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '8', detail: 'pool_mismatch' }),
        v({ code: 'GROUP_BROKEN', tier: 'structural', detail: 'G' }),
        v({ code: 'COUNT', tier: 'structural', expected: 3, actual: 2 }),
      ],
      label,
    )
    expect(r.blockers).toEqual([
      LINES.sectionLine('Bahagian 1', LINES.ineligible('7', 'tiada kunci jawapan')),
      LINES.sectionLine('Bahagian 1', LINES.groupNotConsecutive('G')),
    ])
    expect(r.notes).toHaveLength(1)
  })
})
