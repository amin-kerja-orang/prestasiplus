import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts } from '../../src/modules/bijak/attempts/ports'
import { BijakPapersPorts } from '../../src/modules/bijak/papers/ports'
import { Be09BijakQuestionSource, BankBijakPoolSource, BankPaperQuestionSource } from '../../src/modules/bijak/question-bridge'
import { BijakBuilderPorts, QuestionBankBuilderSource } from '../../src/modules/exam/builder'
import { bootBuilderApp, type BuilderTestApp } from '../exam-builder/helpers'
import { bootIntegrationApp, type IntegrationApp } from '../bijak-integration/helpers'

/**
 * R1-B07: the question bank is the ONLY source of Bijak and builder questions in the running API. The PoC fixture and the composite
 * id split live under `test/support/poc` and `prisma/seed/poc/export`, never in `src`.
 */
describe('bank-sources adapters (unit)', () => {
  it('BankPaperQuestionSource reads placed questions from the bank and has an empty legacy pool', async () => {
    const asked: (readonly string[])[] = []
    const found = new Map([['7', { id: '7' }]])
    const src = new BankPaperQuestionSource({ getMany: (ids) => (asked.push(ids), Promise.resolve(found as never)) })
    expect(await src.getMany(['7', '8'])).toBe(found)
    expect(asked).toEqual([['7', '8']])
    const pool = await src.pool('MAT2-B', { subjectId: '1', kertas: 2 } as never)
    expect(pool.entries).toEqual([])
    expect(pool.groups.size).toBe(0)
  })

  it('BankBijakPoolSource takes candidates from the bank and `seen` from the served port', async () => {
    const calls: string[] = []
    const facts = [{ id: '1' }, { id: '2' }]
    const src = new BankBijakPoolSource(
      { candidatesOf: (subjectId) => (calls.push(subjectId), Promise.resolve(facts as never)) },
      { servedQuestionIds: (userId: string) => Promise.resolve(new Set([`seen-${userId}`])) } as never,
    )
    expect(await src.candidates({ subjectId: '42', kertas: 1 } as never)).toBe(facts)
    expect(calls).toEqual(['42'])
    expect([...(await src.seen('9'))]).toEqual(['seen-9'])
  })
})

describe('src carries no PoC fixture or composite split', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
    })
  it('no source file imports the PoC export or names a PoC/composite source class', () => {
    const offenders = walk(join(__dirname, '../../src')).filter((f) => /prisma\/seed\/poc|PocQuestionSource|PocPoolSource|PocBijakQuestionSource|PocBuilderQuestionSource|Composite(Bijak|Paper|Builder)/.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')))
    expect(offenders).toEqual([])
  })
})

describe('integration wiring registers the bank only', () => {
  let t: IntegrationApp
  beforeAll(async () => {
    t = await bootIntegrationApp({ pocQuestions: false })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('attempts, papers and Jana pool sources are the bank adapters', () => {
    const attempts = t.app.get(BijakAttemptPorts) as unknown as { questions: unknown }
    const papers = t.app.get(BijakPapersPorts) as unknown as { questions: unknown; pools: unknown }
    expect(attempts.questions).toBeInstanceOf(Be09BijakQuestionSource)
    expect(papers.questions).toBeInstanceOf(BankPaperQuestionSource)
    expect(papers.pools).toBeInstanceOf(BankBijakPoolSource)
  })
})

describe('builder wiring registers the bank only', () => {
  let t: BuilderTestApp
  beforeAll(async () => {
    t = await bootBuilderApp({ realBank: true })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('the builder question source is the bank-backed source', () => {
    const ports = t.app.get(BijakBuilderPorts) as unknown as { questions: unknown }
    expect(ports.questions).toBeInstanceOf(QuestionBankBuilderSource)
  })
})
