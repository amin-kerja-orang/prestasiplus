import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { BIJAK_BUILDER_CHECK_LINES } from '@pp/contract'
import { beforeAll, describe, expect, it } from 'vitest'

import { effectiveMarks } from '../../../../src/modules/m28-bijak-spm/domain/paper-model'
import {
  addUnit,
  checkPaper,
  type CheckInput,
  moveUnit,
  publishErrors,
  removeUnit,
  unitsOf,
} from '../../src/modules/exam/builder/paper-check'

const REPO = resolve(__dirname, '../../../..')
const MOCK = join(REPO, 'docs/reference/bijak-paper-builder-mock/domain_paper-builder.ts.txt')
const DOMAIN = join(REPO, 'src/modules/m28-bijak-spm/domain')

type Mock = Pick<
  typeof import('../../src/modules/exam/builder/paper-check'),
  'addUnit' | 'checkPaper' | 'moveUnit' | 'removeUnit' | 'unitsOf'
>
let mock: Mock

beforeAll(async () => {
  const base = process.env.TMPDIR ?? tmpdir()
  await mkdir(base, { recursive: true })
  const dir = await mkdtemp(join(base, 'paper-check-mock-'))
  const src = (await readFile(MOCK, 'utf8'))
    .replace("from './paper-model'", `from '${join(DOMAIN, 'paper-model.ts')}'`)
    .replace("from './types'", `from '${join(DOMAIN, 'types.ts')}'`)
  const file = join(dir, 'mock-paper-builder.ts')
  await writeFile(file, src)
  mock = (await import(/* @vite-ignore */ file)) as Mock
})

/* A small world: groups g1 = [a1, a2], g2 = [b1, b2, b3]; singles s1..s6. */
const GROUPS: Record<string, string[]> = { g1: ['a1', 'a2'], g2: ['b1', 'b2', 'b3'] }
const groupOf = (id: string): string | undefined => Object.keys(GROUPS).find((g) => GROUPS[g]!.includes(id))
const membersOf = (g: string): string[] => GROUPS[g] ?? []
const MARKS: Record<string, number> = { a1: 2, a2: 3, b1: 1, b2: 1, b3: 2, s1: 1, s2: 1, s3: 5, s4: 7, s5: 4, s6: 4 }
const marksOf = (id: string): number => MARKS[id] ?? 0

const ALL = { type: 'all' } as const
const input = (
  specs: CheckInput['specs'],
  sections: string[][],
  live: (id: string) => boolean = () => true,
): CheckInput => ({
  specs,
  sections: sections.map((questionIds) => ({ questionIds })),
  marksOf,
  groupOf,
  membersOf,
  isLive: live,
})
const spec = (label: string, markBudget: number, questionCount: number, rule: CheckInput['specs'][number]['rule'] = ALL) => ({
  label,
  markBudget,
  questionCount,
  rule,
})

const FIXTURES: [string, CheckInput][] = [
  ['conforming', input([spec('A', 2, 2), spec('B', 5, 2)], [['s1', 's2'], ['a1', 'a2']])],
  ['empty', input([spec('A', 2, 2)], [[]])],
  ['no sections', input([spec('A', 2, 2)], [])],
  ['too few', input([spec('A', 3, 3)], [['s1', 's2']])],
  ['too many', input([spec('A', 1, 1)], [['s1', 's2']])],
  ['budget mismatch', input([spec('A', 9, 2)], [['s1', 's2']])],
  ['choose conforming', input([spec('A', 7, 2, { type: 'choose', n: 1 })], [['s3', 's4']])],
  ['choose unequal', input([spec('A', 5, 2, { type: 'choose', n: 1 })], [['s3', 's4']])],
  ['choose equal', input([spec('A', 4, 2, { type: 'choose', n: 1 })], [['s5', 's6']])],
  ['group split', input([spec('A', 3, 2), spec('B', 3, 2)], [['a1', 's1'], ['a2', 's2']])],
  ['group not consecutive', input([spec('A', 4, 4)], [['a1', 's1', 'a2', 's2']])],
  ['group incomplete', input([spec('A', 3, 2)], [['b1', 'b2']])],
  ['duplicate across sections', input([spec('A', 2, 2), spec('B', 2, 2)], [['s1', 's2'], ['s1', 's2']])],
  ['not live', input([spec('A', 2, 2)], [['s1', 's2']], (id) => id !== 's2')],
  ['spec without section', input([spec('A', 2, 2), spec('B', 1, 1)], [['s1', 's2']])],
  ['unknown ids', input([spec('A', 0, 2)], [['zz', 'yy']], () => false)],
]

describe('checkPaper equals the prototype', () => {
  it.each(FIXTURES)('%s', (_name, fixture) => {
    expect(checkPaper(fixture)).toEqual(mock.checkPaper(fixture))
  })

  it('has at least 12 fixtures', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(12)
  })

  it('unitsOf, addUnit, removeUnit and moveUnit equal the prototype', () => {
    const lists = [[], ['s1'], ['a1', 'a2', 's1'], ['s1', 'b1', 'b2', 'b3', 'a1', 'a2'], ['a1', 's1', 'a2']]
    for (const ids of lists) {
      expect(unitsOf(ids, groupOf)).toEqual(mock.unitsOf(ids, groupOf))
      for (const q of ['s1', 's2', 'a1', 'a2', 'b2'] as const) {
        expect(addUnit(ids, q, groupOf, membersOf)).toEqual(mock.addUnit(ids, q, groupOf, membersOf))
        expect(removeUnit(ids, q, groupOf)).toEqual(mock.removeUnit(ids, q, groupOf))
      }
      for (let i = -1; i <= ids.length; i++)
        for (const d of [-1, 1] as const) expect(moveUnit(ids, i, d, groupOf)).toEqual(mock.moveUnit(ids, i, d, groupOf))
    }
  })
})

describe('one non-conforming paper per rule (BM lines)', () => {
  const L = BIJAK_BUILDER_CHECK_LINES

  it('conforming paper is ok', () => {
    const c = checkPaper(FIXTURES[0]![1])
    expect(c.ok).toBe(true)
    expect(c.errors).toEqual([])
    expect(c.totalMarks).toBe(7)
    expect(c.totalBudget).toBe(7)
    expect(publishErrors(c)).toEqual([])
  })

  it('too few', () => {
    const c = checkPaper(input([spec('A', 3, 3)], [['s1', 's2']]))
    expect(c.sections[0]!.errors).toContain('Kurang 1 soalan (perlu 3, ada 2)')
    expect(c.ok).toBe(false)
  })

  it('too many', () => {
    const c = checkPaper(input([spec('A', 2, 1)], [['s1', 's2']]))
    expect(c.sections[0]!.errors).toContain('Lebih 1 soalan (perlu 1, ada 2)')
  })

  it('marks budget mismatch', () => {
    const c = checkPaper(input([spec('A', 9, 2)], [['s1', 's2']]))
    expect(c.sections[0]!.errors).toEqual(['Markah 2 tidak sama dengan bajet 9'])
  })

  it('choose-N counts the N largest (marks 5 and 7, choose 1: effective 7)', () => {
    const rule = { type: 'choose', n: 1 } as const
    const bad = checkPaper(input([spec('A', 5, 2, rule)], [['s3', 's4']]))
    expect(bad.sections[0]!.marks).toBe(7)
    expect(bad.sections[0]!.errors).toEqual(['Markah 7 tidak sama dengan bajet 5'])
    expect(bad.sections[0]!.notes).toEqual(['Soalan pilihan sepatutnya sama markah supaya pilihan adil'])
    const good = checkPaper(input([spec('A', 7, 2, rule)], [['s3', 's4']]))
    expect(good.ok).toBe(true)
  })

  it('group split across sections', () => {
    const c = checkPaper(input([spec('A', 3, 2), spec('B', 3, 2)], [['a1', 's1'], ['a2', 's2']]))
    expect(c.errors).toEqual(['Kumpulan rangsangan g1 dipecahkan antara dua bahagian'])
  })

  it('group not consecutive', () => {
    const c = checkPaper(input([spec('A', 7, 4)], [['a1', 's1', 'a2', 's2']]))
    expect(c.sections[0]!.errors).toEqual(['Kumpulan rangsangan g1 tidak berturutan'])
  })

  it('group incomplete', () => {
    const c = checkPaper(input([spec('A', 2, 2)], [['b1', 'b2']]))
    expect(c.sections[0]!.errors).toEqual(['Kumpulan rangsangan g2 tidak lengkap (1 soalan tiada)'])
  })

  it('duplicate across sections', () => {
    const c = checkPaper(input([spec('A', 2, 2), spec('B', 2, 2)], [['s1', 's2'], ['s1', 's2']]))
    expect(c.errors).toEqual(['Soalan berulang dalam kertas: s1, s2'])
    expect(c.errors[0]).toBe(L.duplicateQuestion(['s1', 's2']))
  })

  it('not Terbit', () => {
    const c = checkPaper(input([spec('A', 2, 2)], [['s1', 's2']], (id) => id === 's1'))
    expect(c.sections[0]!.errors).toEqual(['1 soalan belum Terbit'])
  })

  it('publishErrors: paper-wide first, then "{label}: {error}" per section in order', () => {
    const c = checkPaper(input([spec('Bahagian A', 9, 2), spec('Bahagian B', 1, 1)], [['s1', 's2'], ['s1']]))
    expect(publishErrors(c)).toEqual([
      'Soalan berulang dalam kertas: s1',
      'Bahagian A: Markah 2 tidak sama dengan bajet 9',
    ])
  })
})

describe('section marks come from the shared domain', () => {
  it('equals effectiveMarks of the shared domain', () => {
    for (const [, fixture] of FIXTURES) {
      const c = checkPaper(fixture)
      fixture.specs.forEach((s, i) => {
        const ids = fixture.sections[i]?.questionIds ?? []
        expect(c.sections[i]!.marks).toBe(effectiveMarks(s.rule, ids.map(marksOf)))
      })
    }
  })
})
