import { Controller, Get } from '@nestjs/common'
import { ContractIndex, runScenarios, type Scenario } from '@pp/contract-tests'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Public } from '../../src/common/guards/decorators'
import { apiTarget } from './api-target'
import { bootConformanceApp, type ConformanceApp } from './boot'

/**
 * BE-31 AC3 and AC5: the suite really fails when a controller breaks the contract. A test-only
 * controller (never registered in production) answers `GET /api/public/stats`, a contract
 * operation that no real controller serves yet, with a body that violates the response schema, and
 * then with one that exposes a `legacy_` key.
 */
let mode: 'bad-schema' | 'legacy' = 'bad-schema'

@Controller()
class BrokenController {
  @Public()
  @Get('public/stats')
  stats(): unknown {
    if (mode === 'legacy') return { data: { legacy_id: '17' } }
    return { data: { totalQuestions: 'not-a-number' } }
  }
}

const contract = ContractIndex.load()
let t: ConformanceApp

beforeAll(async () => {
  t = await bootConformanceApp({ controllers: [BrokenController] })
}, 120_000)
afterAll(async () => {
  await t.close()
})

const scenario: Scenario = {
  id: 'negative/GET /public/stats',
  domain: 'account',
  async run(ctx) {
    ctx.expectStatus(await ctx.anonymous().request('GET', '/public/stats'), 200)
  },
}

describe('the conformance suite fails when the API breaks the contract', () => {
  it('a response that violates its schema is a failing scenario (AC3)', async () => {
    mode = 'bad-schema'
    const report = await runScenarios([scenario], { target: apiTarget(t.app), contract })
    expect(report.ok).toBe(false)
    const kinds = report.results[0]?.failures.map((v) => v.kind)
    expect(kinds).toContain('schema')
  })

  it('a response with a legacy_ key is a failing scenario (AC5)', async () => {
    mode = 'legacy'
    const report = await runScenarios([scenario], { target: apiTarget(t.app), contract })
    expect(report.ok).toBe(false)
    expect(report.results[0]?.failures.map((v) => v.kind)).toContain('legacy_key')
  })

  it('a known mismatch is reported apart, and a stale entry fails the run', async () => {
    mode = 'bad-schema'
    const target = apiTarget(t.app)
    const known = [{ scenario: scenario.id, kind: 'schema' as const, reason: 'test only' }]
    const withEntry = await runScenarios([scenario], { target, contract, knownMismatches: known })
    expect(withEntry.results[0]?.known.map((v) => v.kind)).toContain('schema')
    // The same entry on a clean scenario never matches: it is stale and fails the run.
    const clean: Scenario = { id: scenario.id, domain: 'auth', run: async (ctx) => void (await ctx.anonymous().request('GET', '/schools/search')) }
    const stale = await runScenarios([clean], { target, contract, knownMismatches: known })
    expect(stale.stale).toHaveLength(1)
    expect(stale.ok).toBe(false)
  })

  it('an operation no controller serves yet is "not yet implemented", not a failure', async () => {
    const target = apiTarget(t.app)
    const later: Scenario = {
      id: 'negative/not-built',
      domain: 'practice',
      run: async (ctx) => void (await ctx.anonymous().request('GET', '/questions/summary')),
    }
    const report = await runScenarios([later], { target, contract })
    expect(report.ok).toBe(true)
    expect(report.results[0]?.notImplemented).toEqual(['GET /questions/summary'])
    expect(report.notImplemented.has('GET /questions/summary')).toBe(true)
  })
})
