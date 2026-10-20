import { describe, expect, it } from 'vitest'

import { POC_BANK, pocQuestionId } from '../../src/modules/bijak/papers/poc'
import { CompositeBuilderQuestionSource } from '../../src/modules/exam/builder/composite.source'
import { PocBuilderQuestionSource } from '../../src/modules/exam/builder/poc-builder-source'
import { FakeBank, matBank } from './fakes'

const poc = new PocBuilderQuestionSource()
const wire = (key: string): string => pocQuestionId(key).toString()

/** Unit (no DB): BIJAK_POC_QUESTIONS on = PoC fixture plus the bank in the builder. */
describe('CompositeBuilderQuestionSource', () => {
  it('lists the PoC candidates plus the bank candidates (more than the bank alone)', async () => {
    const bank = matBank()
    const composite = new CompositeBuilderQuestionSource(poc, bank)
    const scope = { subject: 'MAT', kertas: 2 }
    const bankIds = await bank.candidates(scope)
    const pocIds = await poc.candidates(scope)
    expect(pocIds.length).toBeGreaterThan(0)
    const ids = await composite.candidates(scope)
    expect(ids).toEqual([...pocIds, ...bankIds])
    expect(ids.length).toBeGreaterThan(bankIds.length)
  })

  it('with an EMPTY bank the builder still lists the PoC questions (the demo case)', async () => {
    const composite = new CompositeBuilderQuestionSource(poc, new FakeBank())
    for (const scope of [
      { subject: 'MAT', kertas: 2 },
      { subject: 'SEJ', kertas: 2 },
    ])
      expect((await composite.candidates(scope)).length).toBeGreaterThan(0)
  })

  it('describes PoC ids as published (the publish gate counts them Terbit) and bank ids from the bank', async () => {
    const composite = new CompositeBuilderQuestionSource(poc, matBank())
    const pocId = wire(POC_BANK.questions[0]!.id)
    const got = await composite.describe([{ id: pocId }, { id: '700001' }, { id: '999999' }])
    expect(got.get(pocId)?.status).toBe('published')
    expect(got.get('700001')?.status).toBe('published')
    expect(got.has('999999')).toBe(false)
  })

  it('review keeps request order across both sources', async () => {
    const composite = new CompositeBuilderQuestionSource(poc, matBank())
    const pocId = wire(POC_BANK.questions[0]!.id)
    const r = await composite.review(['700001', pocId])
    expect(r.questions.map((x) => x.id)).toEqual(['700001', pocId])
  })
})
