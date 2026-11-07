import { describe, expect, it } from 'vitest'

import { composeStandardPaper, previewStandard, scaleSectionCounts, scaleStandardBlueprint } from '../src/compose'
import type { QuestionFacts } from '../src/eligibility'
import { blueprint, facts, leaf, section } from './support/builders'

/** `n` single questions of `marks` marks. */
function singles(prefix: string, n: number, marks = 1): QuestionFacts[] {
  return Array.from({ length: n }, (_, i) => facts(`${prefix}${String(i + 1)}`, { leaves: [leaf({ marks })] }))
}

/** A stimulus group: `size` members of one mark each. */
function group(id: string, size: number): QuestionFacts[] {
  return Array.from({ length: size }, (_, i) => facts(`${id}m${String(i + 1)}`, { groupId: id, groupPosition: i + 1, groupSize: size, leaves: [leaf({ marks: 1 })] }))
}

const twoSections = (a: number, b: number) =>
  blueprint([
    section({ position: 1, label: 'Bahagian A', questionCount: a, markBudget: a }),
    section({ position: 2, label: 'Bahagian B', questionCount: b, markBudget: b }),
  ])

describe('scaleSectionCounts (FR-ADM-Q13.2, largest remainder)', () => {
  it('keeps the proportion and adds up to the count', () => {
    expect(scaleSectionCounts([30, 10], 20)).toEqual([15, 5])
    expect(scaleSectionCounts([20, 20, 10], 10)).toEqual([4, 4, 2])
  })

  it('takes the floors first, then the largest fractions; a tie goes to the earlier section', () => {
    // 7 of 10, 5, 5: 3.5, 1.75, 1.75 -> floors 3, 1, 1; two left go to the two .75
    expect(scaleSectionCounts([10, 5, 5], 7)).toEqual([3, 2, 2])
    // 3 of 3, 1, 2: 1.5, 0.5, 1 -> floors 1, 0, 1; the one left is a tie of .5
    expect(scaleSectionCounts([3, 1, 2], 3)).toEqual([2, 0, 1])
  })

  it('a tie of the fractions is exact: [1,3,6] at 6 keeps every section', () => {
    expect(scaleSectionCounts([1, 3, 6], 6)).toEqual([1, 2, 3])
  })

  it('brute force: every small contract and count against the exact rule in rational terms', () => {
    const exact = (counts: number[], count: number): number[] => {
      const total = counts.reduce((n, c) => n + c, 0)
      const out = counts.map((c) => (count * c - (count * c) % total) / total)
      let left = count - out.reduce((n, c) => n + c, 0)
      while (left > 0) {
        let best = -1
        counts.forEach((c, i) => {
          const taken = out[i]! !== (count * c - (count * c) % total) / total
          if (taken) return
          if (best < 0 || (count * c) % total > (count * counts[best]!) % total) best = i
        })
        out[best]! += 1
        left -= 1
      }
      return out
    }
    for (let a = 1; a <= 12; a++)
      for (let b = 1; b <= 12; b++)
        for (let c = 1; c <= 12; c++)
          for (let k = 1; k <= a + b + c; k++) expect(scaleSectionCounts([a, b, c], k), `${String([a, b, c])}:${String(k)}`).toEqual(exact([a, b, c], k))
  })

  it('always sums to the count', () => {
    for (const counts of [[40], [1, 1, 1], [17, 3, 5, 9], [100, 1]]) {
      const total = counts.reduce((n, c) => n + c, 0)
      for (let c = 1; c <= total; c++) expect(scaleSectionCounts(counts, c).reduce((n, s) => n + s, 0), `${String(counts)}:${String(c)}`).toBe(c)
    }
  })
})

describe('scaleStandardBlueprint (PO decision item 5)', () => {
  const pool = [...singles('a', 40), ...group('g1', 4), ...group('g2', 3)]

  it('the contract total is the blueprint itself; out of range is null', () => {
    const bp = twoSections(30, 10)
    expect(scaleStandardBlueprint(bp, pool, 40)).toBe(bp)
    expect(scaleStandardBlueprint(bp, pool, 41)).toBeNull()
    expect(scaleStandardBlueprint(bp, pool, 0)).toBeNull()
    expect(scaleStandardBlueprint(bp, pool, 1.5)).toBeNull()
  })

  it('scales each section, keeps positions and drops the lines that describe the full contract', () => {
    const bp = blueprint([
      section({
        position: 1,
        label: 'Bahagian A',
        questionCount: 30,
        markBudget: 30,
        kbatMarks: 5,
        marksPerQuestion: Array.from({ length: 30 }, () => 1),
        quota: { basis: 'questions', lines: [{ unit: { kind: 'unit', nodeId: '1' }, value: 30 }] },
      }),
      section({ position: 2, label: 'Bahagian B', questionCount: 10, markBudget: 10 }),
    ])
    const out = scaleStandardBlueprint(bp, pool, 20)!
    expect(out.sections.map((s) => [s.position, s.questionCount, s.markBudget])).toEqual([
      [1, 15, 15],
      [2, 5, 5],
    ])
    expect(out.sections[0]).toMatchObject({ kbatMarks: null, marksPerQuestion: null, quota: null, profile: null })
    expect(out.totalMarks).toBe(20)
  })

  it('a section with no share is left out and the others keep their position', () => {
    const bp = blueprint([section({ position: 1, questionCount: 39, markBudget: 39 }), section({ position: 2, questionCount: 1, markBudget: 1 })])
    expect(scaleStandardBlueprint(bp, pool, 10)!.sections.map((s) => s.position)).toEqual([1])
  })

  it('the N of Pilih N follows the share, the budget follows N', () => {
    const bp = blueprint([section({ position: 1, questionCount: 6, markBudget: 12, rule: { type: 'choose', n: 3 } })])
    const out = scaleStandardBlueprint(bp, singles('c', 8, 4), 2)!
    expect(out.sections[0]).toMatchObject({ questionCount: 2, rule: { type: 'choose', n: 1 }, markBudget: 4 })
  })

  it('a budget the pool cannot hit moves to the nearest sum it can reach', () => {
    const bp = blueprint([section({ position: 1, questionCount: 8, markBudget: 20 })])
    const out = scaleStandardBlueprint(bp, singles('t', 12, 3), 4)!
    // the proportional 10 is not a multiple of 3: 4 questions of 3 marks are 12
    expect(out.sections[0]).toMatchObject({ questionCount: 4, markBudget: 12 })
  })

  it('a scaled draw never splits a stimulus group, a group counts as its number of questions, over many seeds', () => {
    const bp = twoSections(30, 10)
    const target = scaleStandardBlueprint(bp, pool, 12)!
    expect(target.sections.map((s) => s.questionCount)).toEqual([9, 3])
    for (let seed = 1; seed <= 60; seed++) {
      const r = composeStandardPaper(target, pool, { seed })
      if (!r.ok) throw new Error(`seed ${String(seed)}: ${r.reason}`)
      const placed = r.sections.flatMap((s) => s.questionIds)
      expect(placed).toHaveLength(12)
      for (const s of r.sections) {
        for (const [g, size] of [['g1', 4], ['g2', 3]] as const) {
          const at = s.questionIds.flatMap((id, i) => (id.startsWith(`${g}m`) ? [i] : []))
          if (at.length === 0) continue
          expect(at, `seed ${String(seed)}`).toHaveLength(size)
          expect(at[at.length - 1]! - at[0]! + 1).toBe(size)
        }
      }
    }
  })

  it('FR-QA-41: Pilih 2 of 4, budget 4: a group worth more than one choice is not drawn, whatever the seed', () => {
    const bp = blueprint([section({ position: 1, rule: { type: 'choose', n: 2 }, questionCount: 4, markBudget: 4 })])
    const twoSingles = singles('s', 2, 2)
    const pairOf2 = [1, 2].map((i) => facts(`g4m${String(i)}`, { groupId: 'g4', groupPosition: i, groupSize: 2, leaves: [leaf({ marks: 2 })] }))
    for (let seed = 1; seed <= 20; seed++) expect(composeStandardPaper(bp, [...twoSingles, ...pairOf2], { seed }).ok, `seed ${String(seed)}`).toBe(false)
    expect(previewStandard(bp, [...twoSingles, ...pairOf2]).verdict).toBe('tidak_boleh')
    // Positive control: units worth one choice each compose.
    const r = composeStandardPaper(bp, [...singles('s', 4, 2), ...pairOf2], { seed: 1 })
    if (!r.ok) throw new Error(r.reason)
    expect(r.sections[0]!.questionIds.every((id) => id.startsWith('s'))).toBe(true)
  })

  it('FR-QA-41: a scaled draw under Pilih 2 of one 4-member group is refused', () => {
    const bp = blueprint([section({ position: 1, rule: { type: 'choose', n: 4 }, questionCount: 8, markBudget: 8 })])
    const fourOf2 = [1, 2, 3, 4].map((i) => facts(`g8m${String(i)}`, { groupId: 'g8', groupPosition: i, groupSize: 4, leaves: [leaf({ marks: 2 })] }))
    const target = scaleStandardBlueprint(bp, fourOf2, 4)!
    expect(target.sections[0]).toMatchObject({ questionCount: 4, rule: { type: 'choose', n: 2 }, markBudget: 4 })
    expect(composeStandardPaper(target, fourOf2, { seed: 1 }).ok).toBe(false)
    expect(composeStandardPaper(target, singles('s', 4, 2), { seed: 1 }).ok).toBe(true)
  })

  it('a section that only groups could fill is refused rather than cut', () => {
    const bp = blueprint([section({ position: 1, questionCount: 6, markBudget: 6 })])
    const target = scaleStandardBlueprint(bp, group('g9', 4), 3)!
    expect(composeStandardPaper(target, group('g9', 4), { seed: 1 }).ok).toBe(false)
    expect(previewStandard(target, group('g9', 4)).verdict).toBe('tidak_boleh')
  })
})
