import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { NoAnswerStats, NoCoins, NoHistory, NoPapers, NoStructuredAttempts, SpmPorts } from '../../src/modules/spm'
import { bootSpmApp, loginAs, parseData, type SpmTestApp } from './helpers'
import { SpmSubjektifOverviewSchema } from '@pp/contract'

describe('SpmPorts', () => {
  it('defaults to no attempts', async () => {
    const ports = new SpmPorts()
    expect(ports.structuredAttempts).toBeInstanceOf(NoStructuredAttempts)
    expect(await ports.structuredAttempts.statsFor('1', ['1'], { includeTest: false })).toEqual({ setsAnswered: 0, subjectsTried: 0, bestScore: null, bestSetsSaved: 0 })
  })

  it('binding the source twice is a wiring error', () => {
    const ports = new SpmPorts()
    const source = new NoStructuredAttempts()
    ports.provideStructuredAttempts(source)
    expect(ports.structuredAttempts).toBe(source)
    expect(() => ports.provideStructuredAttempts(source)).toThrow(/already set/)
  })
})

describe('SpmPorts papers', () => {
  it('defaults to no papers; binding twice is a wiring error', async () => {
    const ports = new SpmPorts()
    expect(ports.papers).toBeInstanceOf(NoPapers)
    expect(await ports.papers.countPublishedSubjektif()).toBe(0)
    ports.providePapers({ countPublishedSubjektif: async () => 4 })
    expect(await ports.papers.countPublishedSubjektif()).toBe(4)
    expect(() => ports.providePapers(new NoPapers())).toThrow(/already set/)
  })
})

describe('SpmPorts answer stats, coins and history (S3-T07 part F)', () => {
  it('default to nothing: no answers, no sessions, no coins, no rows', async () => {
    const ports = new SpmPorts()
    expect(ports.answerStats).toBeInstanceOf(NoAnswerStats)
    expect(ports.coins).toBeInstanceOf(NoCoins)
    expect(ports.history).toBeInstanceOf(NoHistory)
    expect(await ports.answerStats.statsFor('1', { includeTest: false })).toEqual({ answered: 0, correct: 0, sessions: 0 })
    expect(await ports.coins.earnedCoins('1', { includeTest: false })).toBe(0)
    expect(await ports.history.page({ userId: '1', includeTest: false, chip: 'all', page: 1, pageSize: 15 })).toEqual({ rows: [], total: 0 })
  })

  it('each binds once; a second binding is a wiring error', () => {
    const ports = new SpmPorts()
    ports.provideAnswerStats(new NoAnswerStats())
    ports.provideCoins(new NoCoins())
    ports.provideHistory(new NoHistory())
    expect(() => ports.provideAnswerStats(new NoAnswerStats())).toThrow(/already set/)
    expect(() => ports.provideCoins(new NoCoins())).toThrow(/already set/)
    expect(() => ports.provideHistory(new NoHistory())).toThrow(/already set/)
  })
})

describe('boot with the default structured-attempt port', () => {
  let t: SpmTestApp
  beforeAll(async () => {
    t = await bootSpmApp({ defaultAttempts: true })
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('the Subjektif stats are the empty ones until BE-13 binds the adapter', async () => {
    const c = await loginAs(t, 'student')
    const s = parseData(await c.get('/api/spm/subjektif'), SpmSubjektifOverviewSchema)
    expect(s.stats).toEqual({ setsAnswered: 0, subjectsTried: 0, bestScore: null, bestSetsSaved: 0 })
    expect(s.subjects).toHaveLength(15)
  })
})
