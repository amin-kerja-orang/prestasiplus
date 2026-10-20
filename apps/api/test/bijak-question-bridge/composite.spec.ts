import { describe, expect, it, vi } from 'vitest'

import type {
  BijakQuestionBundle,
  BijakQuestionSource as AttemptSource,
} from '../../src/modules/bijak/attempts/ports'
import {
  CompositeBijakQuestionSource,
  CompositePaperQuestionSource,
  isPocReservedId,
} from '../../src/modules/bijak/question-bridge/composite'
import type {
  BijakPool,
  BijakPoolScope,
  BijakQuestionInfo,
  BijakQuestionSource as PaperSource,
} from '../../src/modules/bijak/papers/ports'

const bundle = (id: string, tag: string): BijakQuestionBundle => ({
  question: { id } as BijakQuestionBundle['question'],
  schemes: { [id]: { kind: 'option', marks: 1, correct: 'A', reason: tag } },
})
const info = (id: string, tag: string): BijakQuestionInfo => ({
  id,
  marks: 1,
  groupId: tag,
  versionNo: 1,
})

function fakeAttemptSource(tag: string) {
  return {
    loadQuestions: vi.fn((ids: readonly string[]) =>
      Promise.resolve(new Map(ids.map((id) => [id, bundle(id, tag)]))),
    ),
  } satisfies AttemptSource
}

const SCOPE = { subject: 'MAT' } as unknown as BijakPoolScope
const pool = (tag: string): BijakPool => ({ entries: [{ questionId: tag }], groups: new Map() })

function fakePaperSource(tag: string) {
  return {
    getMany: vi.fn((ids: readonly string[]) =>
      Promise.resolve(new Map(ids.map((id) => [id, info(id, tag)]))),
    ),
    pool: vi.fn<PaperSource['pool']>(() => Promise.resolve(pool(tag))),
  } satisfies PaperSource
}

describe('isPocReservedId', () => {
  it.each([
    ['8999999999', false],
    ['9000000000', true],
    ['9000000001', true],
    ['9999999999', true],
    ['10000000000', false],
    ['1', false],
    ['501', false],
    ['0', false],
    ['abc', false],
    ['012', false],
    ['', false],
    ['9000000000.5', false],
    ['-9000000000', false],
    ['9e9', false],
  ])('%s -> %s', (id, expected) => {
    expect(isPocReservedId(id)).toBe(expected)
  })
})

describe('CompositeBijakQuestionSource', () => {
  it('routes each id to its source and merges the results', async () => {
    const poc = fakeAttemptSource('poc')
    const bank = fakeAttemptSource('bank')
    const out = await new CompositeBijakQuestionSource(poc, bank).loadQuestions([
      '9000000001',
      '501',
      '9000000002',
      '7',
    ])
    expect(poc.loadQuestions).toHaveBeenCalledTimes(1)
    expect(poc.loadQuestions).toHaveBeenCalledWith(['9000000001', '9000000002'])
    expect(bank.loadQuestions).toHaveBeenCalledTimes(1)
    expect(bank.loadQuestions).toHaveBeenCalledWith(['501', '7'])
    expect([...out.keys()].sort()).toEqual(['501', '7', '9000000001', '9000000002'])
    expect(out.get('501')?.schemes['501']).toMatchObject({ reason: 'bank' })
    expect(out.get('9000000001')?.schemes['9000000001']).toMatchObject({ reason: 'poc' })
  })

  it('never calls a source with an empty list', async () => {
    const poc = fakeAttemptSource('poc')
    const bank = fakeAttemptSource('bank')
    const c = new CompositeBijakQuestionSource(poc, bank)
    await c.loadQuestions(['501'])
    expect(poc.loadQuestions).not.toHaveBeenCalled()
    await c.loadQuestions(['9000000005'])
    expect(bank.loadQuestions).toHaveBeenCalledTimes(1)
    expect((await c.loadQuestions([])).size).toBe(0)
    expect(poc.loadQuestions).toHaveBeenCalledTimes(1)
    expect(bank.loadQuestions).toHaveBeenCalledTimes(1)
  })

  it('de-duplicates ids and sends malformed ids to the bank', async () => {
    const poc = fakeAttemptSource('poc')
    const bank = fakeAttemptSource('bank')
    await new CompositeBijakQuestionSource(poc, bank).loadQuestions([
      '501',
      '501',
      'abc',
      '9000000001',
      '9000000001',
    ])
    expect(bank.loadQuestions).toHaveBeenCalledWith(['501', 'abc'])
    expect(poc.loadQuestions).toHaveBeenCalledWith(['9000000001'])
  })

  it('an id a source omits stays absent', async () => {
    const poc: AttemptSource = {
      loadQuestions: () => Promise.resolve(new Map<string, BijakQuestionBundle>()),
    }
    const bank = fakeAttemptSource('bank')
    const out = await new CompositeBijakQuestionSource(poc, bank).loadQuestions([
      '9000000001',
      '501',
    ])
    expect([...out.keys()]).toEqual(['501'])
  })
})

describe('CompositePaperQuestionSource', () => {
  it('getMany routes ids and merges the infos', async () => {
    const poc = fakePaperSource('poc')
    const bank = fakePaperSource('bank')
    const out = await new CompositePaperQuestionSource(poc, bank).getMany([
      '501',
      '9000000003',
      '9000000004',
    ])
    expect(poc.getMany).toHaveBeenCalledWith(['9000000003', '9000000004'])
    expect(bank.getMany).toHaveBeenCalledWith(['501'])
    expect(out.get('501')?.groupId).toBe('bank')
    expect(out.get('9000000003')?.groupId).toBe('poc')
    expect(out.size).toBe(3)
  })

  it('getMany never calls a source with an empty list', async () => {
    const poc = fakePaperSource('poc')
    const bank = fakePaperSource('bank')
    const c = new CompositePaperQuestionSource(poc, bank)
    await c.getMany(['501'])
    expect(poc.getMany).not.toHaveBeenCalled()
    await c.getMany(['9000000003'])
    expect(bank.getMany).toHaveBeenCalledTimes(1)
    expect((await c.getMany([])).size).toBe(0)
  })

  it('pool always goes to the PoC source', async () => {
    const poc = fakePaperSource('poc')
    const bank = fakePaperSource('bank')
    const out = await new CompositePaperQuestionSource(poc, bank).pool('MAT1-A', SCOPE)
    expect(poc.pool).toHaveBeenCalledWith('MAT1-A', SCOPE)
    expect(out.entries).toEqual([{ questionId: 'poc' }])
    expect(bank.getMany).not.toHaveBeenCalled()
  })
})
