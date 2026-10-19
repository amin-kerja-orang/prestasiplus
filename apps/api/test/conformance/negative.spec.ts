import { Controller, Get } from '@nestjs/common'
import { ContractIndex, runScenarios, type Scenario } from '@pp/contract-tests'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Public } from '../../src/common/guards/decorators'
import { apiTarget, registeredRoutes, unknownRoutes } from './api-target'
import { bootConformanceApp, type ConformanceApp } from './boot'

/**
 * BE-31 AC3 and AC5: the suite really fails when a controller breaks the contract. A test-only
 * controller (never registered in production) is mounted on `/api/__conformance-negative/*`, a path
 * that no real route can collide with, and a test-only contract fixture (the real `openapi.json`
 * plus these operations) describes it. So the tests do not depend on which cards are built.
 */
const BASE = '/__conformance-negative'

@Controller('__conformance-negative')
class BrokenController {
  @Public()
  @Get('ok')
  ok(): unknown {
    return { data: { count: 1 } }
  }

  @Public()
  @Get('schema')
  schema(): unknown {
    return { data: { count: 'not-a-number' } }
  }

  @Public()
  @Get('legacy')
  legacy(): unknown {
    return { data: { count: 1, legacy_id: '17' } }
  }

  /** A typo: this route is in no contract operation. */
  @Public()
  @Get('typo')
  typo(): unknown {
    return { data: { count: 1 } }
  }
}

const countBody = {
  description: 'ok',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['count'],
            properties: { count: { type: 'integer' }, legacy_id: { type: 'string' } },
          },
        },
      },
    },
  },
}
const op = { tags: ['negative'], responses: { '200': countBody } }

function fixtureContract(): ContractIndex {
  const base = ContractIndex.load().spec as { paths: Record<string, unknown> }
  const spec = {
    ...base,
    paths: {
      ...base.paths,
      [`${BASE}/ok`]: { get: op },
      [`${BASE}/schema`]: { get: op },
      [`${BASE}/legacy`]: { get: op },
      [`${BASE}/unbuilt`]: { get: op }, // no controller: "not yet implemented"
    },
  }
  return new ContractIndex(spec as never)
}

const contract = fixtureContract()
let t: ConformanceApp

beforeAll(async () => {
  t = await bootConformanceApp({ controllers: [BrokenController] })
}, 120_000)
afterAll(async () => {
  await t.close()
})

const get = (id: string, path: string): Scenario => ({
  id,
  domain: 'negative',
  async run(ctx) {
    ctx.expectStatus(await ctx.anonymous().request('GET', path), 200)
  },
})

describe('the conformance suite fails when the API breaks the contract', () => {
  it('a response that violates its schema is a failing scenario (AC3)', async () => {
    const report = await runScenarios([get('negative/schema', `${BASE}/schema`)], { target: apiTarget(t.app), contract })
    expect(report.ok).toBe(false)
    expect(report.results[0]?.failures.map((v) => v.kind)).toContain('schema')
  })

  it('a response with a legacy_ key is a failing scenario (AC5)', async () => {
    const report = await runScenarios([get('negative/legacy', `${BASE}/legacy`)], { target: apiTarget(t.app), contract })
    expect(report.ok).toBe(false)
    expect(report.results[0]?.failures.map((v) => v.kind)).toContain('legacy_key')
  })

  it('a correct response passes, and the request was really sent', async () => {
    const report = await runScenarios([get('negative/ok', `${BASE}/ok`)], { target: apiTarget(t.app), contract })
    expect(report.ok).toBe(true)
    expect(report.requests).toBe(1)
    expect(report.touched.has(`GET ${BASE}/ok`)).toBe(true)
  })

  it('a known mismatch is reported apart, and a stale entry fails the run', async () => {
    const target = apiTarget(t.app)
    const known = [{ scenario: 'negative/schema', kind: 'schema' as const, reason: 'test only' }]
    const withEntry = await runScenarios([get('negative/schema', `${BASE}/schema`)], { target, contract, knownMismatches: known })
    expect(withEntry.results[0]?.known.map((v) => v.kind)).toContain('schema')
    // The same entry on a scenario that is clean never matches: stale, the run fails.
    const stale = await runScenarios([get('negative/schema', `${BASE}/ok`)], { target, contract, knownMismatches: known })
    expect(stale.stale).toHaveLength(1)
    expect(stale.ok).toBe(false)
  })

  it('an operation no controller serves yet is "not yet implemented", not a failure', async () => {
    const report = await runScenarios([get('negative/unbuilt', `${BASE}/unbuilt`)], { target: apiTarget(t.app), contract })
    expect(report.ok).toBe(true)
    expect(report.requests).toBe(0)
    expect(report.results[0]?.notImplemented).toEqual([`GET ${BASE}/unbuilt`])
  })

  it('a registered route that is in no contract operation is flagged by the reverse check', () => {
    // Allow-listed routes (NON_CONTRACT_ROUTES) are not reported; the typo is, and nothing else is.
    const flagged = unknownRoutes(registeredRoutes(t.app), contract)
    expect(flagged).toContain(`GET ${BASE}/typo`)
    expect(flagged.filter((k) => k !== `GET ${BASE}/typo`)).toEqual([])
  })
})
