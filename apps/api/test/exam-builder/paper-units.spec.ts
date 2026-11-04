import { BIJAK_BUILDER_CHECK_LINES as LINES, BIJAK_BUILDER_INELIGIBLE_TEXT as INELIGIBLE_TEXT } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import type { Violation } from '../../src/modules/exam/builder/exam-core.adapter'
import { GROUP_MIN_MEMBERS_MESSAGE, MISSING_FROM_POOL_TEXT } from '../../src/modules/exam/builder/builder.constants'
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

  it('only the blueprint-conformance failures are overridable (no unit, no TP, tags awaiting review); the structural ones are fixed (PIPE AC-07.5 / AC-26.3)', () => {
    const r = violationLines(
      [
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '1', detail: 'no_unit' }),
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '2', detail: 'no_tp' }),
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '3', detail: 'tag_review' }),
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '7', detail: 'no_key' }),
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '6', detail: 'no_marks' }),
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '5', detail: 'mode_not_allowed' }),
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '8', detail: 'pool_mismatch' }),
        v({ code: 'GROUP_BROKEN', tier: 'structural', detail: 'G' }),
        v({ code: 'COUNT', tier: 'structural', expected: 3, actual: 2 }),
      ],
      label,
    )
    expect(r.blockerIssues.map((b) => [b.code, b.questionId])).toEqual([['INELIGIBLE', '1'], ['INELIGIBLE', '2'], ['INELIGIBLE', '3']])
    expect(r.fixedIssues.map((b) => [b.code, b.questionId])).toEqual([
      ['NO_KEY', '7'],
      ['NO_MARKS', '6'],
      ['MODE_NOT_ALLOWED', '5'],
      ['GROUP_BROKEN', undefined],
    ])
    expect(r.fixed).toContain(LINES.sectionLine('Bahagian 1', LINES.ineligible('7', 'tiada kunci jawapan')))
    expect(r.fixed).toContain(LINES.sectionLine('Bahagian 1', LINES.groupNotConsecutive('G')))
    expect(r.notes).toHaveLength(1) // the pool mismatch only notes
  })

  it('a question missing from the pool is a fixed blocker with its id; the other blockers are kept', () => {
    const r = violationLines(
      [
        v({ code: 'UNKNOWN_QUESTION', tier: 'structural', questionId: '9' }),
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '7', detail: 'no_key' }),
        v({ code: 'INELIGIBLE', tier: 'structural', questionId: '4', detail: 'no_unit' }),
      ],
      label,
    )
    expect(r.fixed).toEqual([
      LINES.sectionLine('Bahagian 1', LINES.ineligible('9', MISSING_FROM_POOL_TEXT)),
      LINES.sectionLine('Bahagian 1', LINES.ineligible('7', 'tiada kunci jawapan')),
    ])
    expect(r.blockers).toEqual([LINES.sectionLine('Bahagian 1', LINES.ineligible('4', INELIGIBLE_TEXT.no_unit))])
  })
})

describe('D93: a stimulus group with no member (a group holds 1..n)', () => {
  const base = {
    specs: [{ label: 'A', markBudget: 2, questionCount: 2, rule: { type: 'all' as const } }],
    marksOf: () => 1,
    isLive: () => true,
  }
  it('is a paper-level error with the exact BM line (not section-prefixed, hard)', () => {
    const empty = checkPaper({ ...base, groupOf: (id) => (id === 'g1' ? 'G' : undefined), membersOf: () => [], sections: [{ questionIds: ['g1', 'a'] }] })
    expect(empty.errors).toEqual(['Kumpulan perlu sekurang-kurangnya 1 soalan.'])
    // S1-T01: one member is a valid group
    const alone = checkPaper({ ...base, groupOf: (id) => (id === 'g1' ? 'G' : undefined), membersOf: () => ['g1'], sections: [{ questionIds: ['g1', 'a'] }] })
    expect(alone.errors).toEqual([])
    expect(GROUP_MIN_MEMBERS_MESSAGE).toBe('Kumpulan perlu sekurang-kurangnya 1 soalan.')
    expect(alone.ok).toBe(true)
    expect(empty.ok).toBe(false)
  })
  it('does not apply to a group of two or more, nor to a group the bank does not know as a stimulus group', () => {
    const two = checkPaper({ ...base, groupOf, membersOf, sections: [{ questionIds: ['g1', 'g2'] }] })
    expect(two.errors).toEqual([])
    const unknown = checkPaper({ ...base, groupOf: () => 'X', membersOf: () => ['a'], isStimulusGroup: () => false, sections: [{ questionIds: ['a', 'b'] }] })
    expect(unknown.errors).toEqual([])
  })
})
