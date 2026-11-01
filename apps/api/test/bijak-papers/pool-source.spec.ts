import { describeQuestion, eligibilityOf, excludedReport, type QuestionFacts } from '@pp/exam-core'
import { describe, expect, it } from 'vitest'

import { BijakPapersPorts } from '../../src/modules/bijak/papers/ports'
import { PocPoolSource } from '../support/poc/pool-source'
import { excludedBankQuery, poolTotals, sectionPoolCounts } from '../../src/modules/bijak/papers/pool-source'
import { BankBijakPoolSource } from '../../src/modules/bijak/question-bridge'

const leaf = (over: Partial<QuestionFacts['leaves'][number]> = {}): QuestionFacts['leaves'][number] => ({
  marks: 2,
  mode: 'short_text',
  tp: 3,
  kbat: false,
  hasKey: true,
  ...over,
})
const q = (id: string, over: Partial<QuestionFacts> = {}): QuestionFacts => ({
  id,
  groupId: null,
  groupPosition: null,
  versionNo: 1,
  tagReview: false,
  unit: { nodeId: '10', level: 'T4', code: '1' },
  formOrigin: 't4',
  pools: ['P'],
  leaves: [leaf()],
  ...over,
})

describe('PocPoolSource (BJS-07)', () => {
  const poc = new PocPoolSource()

  it('serves the fixture questions of a subject as facts that exam-core accepts', async () => {
    const mat = await poc.candidates({ subjectId: '1', subjectCode: 'MATH', kertas: 1 })
    expect(mat.length).toBeGreaterThan(40)
    const first = mat.find((f) => f.pools.includes('MAT1-A')) as QuestionFacts
    expect(first.leaves).toHaveLength(1)
    expect(first.leaves[0]).toMatchObject({ mode: 'mcq', kbat: false, hasKey: true })
    expect(first.tagReview).toBe(false)
    for (const f of mat) expect(describeQuestion(f).reasons).toEqual([])
    expect(excludedReport(mat).total).toBe(0)
    const sn = await poc.candidates({ subjectId: '2', subjectCode: 'SCI', kertas: 1 })
    expect(sn.length).toBeGreaterThan(0)
    expect(sn.every((f) => !mat.some((m) => m.id === f.id))).toBe(true)
    expect(await poc.candidates({ subjectId: '3', subjectCode: 'XXX', kertas: 1 })).toEqual([])
  })

  it('maps groups (position and size), T4/T5 to a synthetic unit and T1-T3 to the bucket', async () => {
    const mat = await poc.candidates({ subjectId: '1', subjectCode: 'MATH', kertas: 1 })
    const grouped = mat.filter((f) => f.groupId)
    expect(grouped.length).toBeGreaterThan(0)
    for (const g of grouped) {
      expect(g.groupSize).toBeGreaterThan(1)
      expect(g.groupPosition).toBeGreaterThanOrEqual(1)
    }
    expect(mat.filter((f) => f.formOrigin === 't1_t3').every((f) => f.unit === null)).toBe(true)
    const withUnit = mat.filter((f) => f.formOrigin !== 't1_t3')
    expect(withUnit.length).toBeGreaterThan(0)
    expect(withUnit.every((f) => f.unit?.nodeId.startsWith('poc:'))).toBe(true)
    expect((await poc.seen()).size).toBe(0)
  })
})

describe('pool totals and section counts (BJS-07)', () => {
  const list = [
    q('1'),
    q('2', { tagReview: true }),
    q('3', { unit: null }),
    q('4', { leaves: [leaf({ tp: null })] }),
    q('5', { leaves: [leaf({ marks: 0 })] }),
    q('6', { leaves: [leaf({ hasKey: false })] }),
    q('7', { leaves: [leaf({ mode: 'mcq' })] }),
    q('8', { unit: null, formOrigin: 't1_t3' }),
    q('9', { unit: null, tagReview: true, leaves: [leaf({ tp: null, hasKey: false })] }),
  ]

  it('publishedTotal = eligibleTotal + excluded.total; byReason may overlap; links follow 15.7', () => {
    const t = poolTotals(list, '7')
    expect(t.publishedTotal).toBe(9)
    expect(t.eligibleTotal).toBe(3)
    expect(t.excluded.total).toBe(6)
    expect(t.publishedTotal).toBe(t.eligibleTotal + t.excluded.total)
    expect(Object.fromEntries(t.excluded.byReason.map((r) => [r.reason, r.count]))).toEqual({
      no_unit: 2,
      no_tp: 2,
      no_marks: 1,
      no_key: 2,
      tag_review: 2,
    })
    expect(excludedBankQuery('no_unit', '7')).toEqual({ subjectId: '7', status: 'approved', dskpFilter: 'untagged' })
    expect(excludedBankQuery('no_tp', '7')).toEqual({ subjectId: '7', status: 'approved', missing: 'tp' })
    expect(excludedBankQuery('tag_review', '7')).toEqual({ subjectId: '7', status: 'approved', tagReview: 'true' })
    expect(t.excluded.byReason.every((r) => r.bankQuery.subjectId === '7')).toBe(true)
  })

  it('an empty pool is all zeros', () => {
    expect(poolTotals([], '7')).toMatchObject({ publishedTotal: 0, eligibleTotal: 0, excluded: { total: 0 } })
  })

  it('section counts: eligible, and modeExcluded only for base-eligible questions of the pool', () => {
    expect(sectionPoolCounts(list, { allowedModes: [], pool: 'P' })).toEqual({ eligible: 3, modeExcluded: 0 })
    expect(sectionPoolCounts(list, { allowedModes: ['short_text'], pool: 'P' })).toEqual({ eligible: 2, modeExcluded: 1 })
    expect(sectionPoolCounts(list, { allowedModes: ['short_text'], pool: 'OTHER' })).toEqual({ eligible: 0, modeExcluded: 0 })
    expect(eligibilityOf(list[6] as QuestionFacts, { allowedModes: ['short_text'], quota: null }).reasons).toEqual(['mode_not_allowed'])
  })
})

describe('BankBijakPoolSource and the ports holder (BJS-07, R1-B07)', () => {
  it('serves the bank facts only (the PoC fixture is gone); seen delegates to the served port', async () => {
    const bank = { candidatesOf: async (id: string) => [q(`b${id}`)] }
    const served = { servedQuestionIds: async () => new Set(['5']) }
    const scope = { subjectId: '1', subjectCode: 'MATH', kertas: 1 }
    const source = new BankBijakPoolSource(bank, served)
    const facts = await source.candidates(scope)
    expect(facts.map((f) => f.id)).toEqual(['b1'])
    expect([...(await source.seen('9'))]).toEqual(['5'])
  })

  it('the holder defaults to an empty pool and refuses a second provider', async () => {
    const ports = new BijakPapersPorts()
    expect(await ports.poolSource.candidates({ subjectId: '1', subjectCode: 'MATH', kertas: 1 })).toEqual([])
    expect([...(await ports.poolSource.seen('1'))]).toEqual([])
    const other = new PocPoolSource()
    ports.providePoolSource(other)
    expect(ports.poolSource).toBe(other)
    expect(() => ports.providePoolSource(other)).toThrow(/already set/)
  })
})
