import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { NoStructuredAttempts, SpmPorts } from '../../src/modules/spm'
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
