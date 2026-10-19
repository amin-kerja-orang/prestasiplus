import { describe, expect, it } from 'vitest'

import { computeCoverage, coverageFailure, formatCoverage, notImplementedFailure } from '../coverage'
import { ContractIndex, fixNullableRefs } from '../contract-index'
import { findLegacyKeys } from '../guards'
import type { HttpClient, HttpResponse, Target } from '../http-client'
import { formatRun } from '../report'
import { NotImplementedSignal, rethrowNotImplemented, runScenarios, type Scenario } from '../runner'
import { parseSetCookie, sessionLogin } from '../session'

const contract = ContractIndex.load()

/** A target whose every call answers with `answer(method, path)`. */
function fakeTarget(answer: (method: string, path: string) => Partial<HttpResponse>): Target {
  const client: HttpClient = {
    request: (method, path) =>
      Promise.resolve({ status: 200, headers: {}, body: null, ...answer(method, path) }),
  }
  return {
    name: 'fake',
    anonymous: client,
    actor: () => Promise.resolve(client),
    credentials: () => ({ identifier: 'x', password: 'y' }),
  }
}

const call = (method: 'GET' | 'POST', path: string): Scenario => ({
  id: `${method} ${path}`,
  domain: 't',
  async run(ctx) {
    await ctx.anonymous().request(method, path)
  },
})

describe('contract index', () => {
  it('indexes every operation of openapi.json and matches concrete paths', () => {
    expect(contract.operations.length).toBeGreaterThan(200)
    expect(contract.match('GET', '/articles/hot')?.key).toBe('GET /articles/hot')
    expect(contract.match('GET', '/articles/some-slug?x=1')?.key).toBe('GET /articles/{slug}')
    expect(contract.match('GET', '/nope')).toBeNull()
    expect(contract.match('DELETE', '/articles/hot')).toBeNull()
  })

  it('builds a zod schema for every declared JSON response', () => {
    for (const op of contract.operations) {
      for (const [status, hasJson] of Object.entries(op.responses)) {
        const schema = contract.schemaFor(op, Number(status))
        expect(schema !== null, `${op.key} ${status}`).toBe(hasJson)
      }
    }
  }, 120_000)
})

describe('nullable reference reading', () => {
  it('reads allOf[$ref, null-type] as anyOf[$ref, null]', () => {
    const wrapped = { allOf: [{ $ref: '#/$defs/Id' }, { type: ['string', 'null'] }] }
    expect(fixNullableRefs({ a: [wrapped] })).toEqual({
      a: [{ anyOf: [{ $ref: '#/$defs/Id' }, { type: 'null' }] }],
    })
  })

  it('lets a null practice activeType through', async () => {
    const body = { data: [], meta: { page: 1, pageSize: 15, total: 0, activeType: null } }
    const op = contract.match('GET', '/practice/sessions')
    expect(op).not.toBeNull()
    const parsed = contract.schemaFor(op!, 200)!.safeParse({
      ...body,
      meta: { ...body.meta, stats: {} },
    })
    expect(JSON.stringify(parsed.error?.issues ?? []).includes('activeType')).toBe(false)
  })
})

describe('runner: schema conformance (AC3 negative test)', () => {
  it('fails when a body violates its response schema', async () => {
    const wallet = '/gamification/wallet'
    const bad = fakeTarget(() => ({ status: 200, body: { data: 'not an object' } }))
    const report = await runScenarios([call('GET', wallet)], { target: bad, contract })
    expect(report.ok).toBe(false)
    expect(report.results[0]?.failures[0]).toMatchObject({
      kind: 'schema',
      operation: `GET ${wallet}`,
    })
  })

  it('fails on an unknown path and on a status the contract does not declare', async () => {
    const report = await runScenarios([call('GET', '/nope'), call('GET', '/session')], {
      target: fakeTarget((_m, path) => (path === '/session' ? { status: 418, body: {} } : {})),
      contract,
    })
    expect(report.results.map((r) => r.failures[0]?.kind)).toEqual([
      'unknown_operation',
      'undocumented_status',
    ])
  })

  it('accepts a correct error body and an empty 204', async () => {
    const report = await runScenarios([call('GET', '/session'), call('POST', '/auth/logout')], {
      target: fakeTarget((_m, path) =>
        path === '/session'
          ? { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Sila log masuk.' } } }
          : { status: 204, body: null },
      ),
      contract,
    })
    expect(report.results.flatMap((r) => r.violations)).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('rejects a missing required field', async () => {
    const report = await runScenarios([call('GET', '/session')], {
      target: fakeTarget(() => ({ status: 401, body: { error: { code: 'UNAUTHORIZED' } } })),
      contract,
    })
    expect(report.results[0]?.failures[0]?.kind).toBe('schema')
  })
})

describe('body-less responses', () => {
  it('flags a body on a status that only the default response covers', async () => {
    const spec = {
      paths: {
        '/x': {
          get: { responses: { '200': { description: 'ok' }, default: { description: 'none' } } },
        },
      },
    }
    const small = new ContractIndex(spec)
    const client: HttpClient = {
      request: () => Promise.resolve({ status: 500, headers: {}, body: { oops: true } }),
    }
    const target: Target = { ...fakeTarget(() => ({})), anonymous: client }
    const report = await runScenarios([call('GET', '/x')], { target, contract: small })
    expect(report.results[0]?.failures.map((f) => f.kind)).toEqual(['schema'])
  })
})

describe('legacy_ key guard (AC5)', () => {
  it('finds legacy_ keys at any depth, inside arrays too', () => {
    expect(findLegacyKeys({ data: [{ id: '1', nested: { legacy_id: 4 } }], legacy_x: 1 })).toEqual([
      '$.data[0].nested.legacy_id',
      '$.legacy_x',
    ])
    expect(findLegacyKeys({ data: { legacy: 1, notlegacy_: 2 } })).toEqual([])
    expect(findLegacyKeys(null)).toEqual([])
  })

  it('fails a run whose response exposes a legacy_ key', async () => {
    const report = await runScenarios([call('GET', '/session')], {
      target: fakeTarget(() => ({
        status: 401,
        body: { error: { code: 'UNAUTHORIZED', message: 'm', details: { legacy_user_id: 3 } } },
      })),
      contract,
    })
    expect(report.results[0]?.failures.map((f) => f.kind)).toContain('legacy_key')
  })
})

describe('known mismatches', () => {
  it('reports them apart, and flags an entry that no longer occurs as stale', async () => {
    const s = call('GET', '/nope')
    const target = fakeTarget(() => ({}))
    const known = await runScenarios([s], {
      target,
      contract,
      knownMismatches: [{ scenario: s.id, reason: 'path missing from the contract' }],
    })
    expect(known.results[0]?.known).toHaveLength(1)
    expect(known.results[0]?.failures).toHaveLength(0)
    expect(known.ok).toBe(true)
    expect(formatRun(known)).toContain('known GET /nope')

    const stale = await runScenarios([call('GET', '/session')], {
      target: fakeTarget(() => ({
        status: 401,
        body: { error: { code: 'UNAUTHORIZED', message: 'm' } },
      })),
      contract,
      knownMismatches: [{ scenario: 'GET /session', reason: 'was broken' }],
    })
    expect(stale.stale).toHaveLength(1)
    expect(stale.ok).toBe(false)
  })
})

describe('coverage report (AC2)', () => {
  it('lists every operation and applies CONFORMANCE_MIN_COVERAGE', async () => {
    const report = await runScenarios([call('GET', '/session')], {
      target: fakeTarget(() => ({})),
      contract,
    })
    const cov = computeCoverage(contract, report)
    expect(cov.total).toBe(contract.operations.length)
    expect(cov.covered).toBe(1)
    expect(cov.uncovered).not.toContain('GET /session')
    expect(formatCoverage(cov)).toMatch(/1\/\d+ operations \(\d+\.\d%\)/)
    expect(coverageFailure(cov, {})).toBeNull()
    expect(coverageFailure(cov, { CONFORMANCE_MIN_COVERAGE: '100' })).toMatch(/below/)
    expect(coverageFailure(cov, { CONFORMANCE_MIN_COVERAGE: 'abc' })).toMatch(/not a number/)
  })
})

describe('session helper', () => {
  it('keeps cookies and adds the CSRF header to non-GET calls only', async () => {
    const seen: { method: string; headers: Record<string, string> | undefined }[] = []
    const base: HttpClient = {
      request(method, path, init) {
        if (path === '/auth/login') {
          return Promise.resolve({
            status: 200,
            headers: { 'set-cookie': 'sid=abc; Path=/; HttpOnly\nother=1; Path=/' },
            body: { data: { csrf: 'tok' } },
          })
        }
        seen.push({ method, headers: init?.headers })
        return Promise.resolve({ status: 204, headers: {}, body: null })
      },
    }
    const session = await sessionLogin(base, { identifier: 'a', password: 'b' })
    await session.request('GET', '/session')
    await session.request('POST', '/auth/logout')
    await session.withoutCsrf().request('POST', '/auth/logout')
    expect(seen.map((s) => s.headers?.['x-csrf-token'])).toEqual([undefined, 'tok', undefined])
    expect(seen[0]?.headers?.cookie).toBe('sid=abc; other=1')
    expect(parseSetCookie(undefined)).toEqual({})
  })
})

describe('session helper follows rotation', () => {
  it('takes the new cookie and csrf token the server sends after a role switch', async () => {
    const seen: Record<string, string>[] = []
    const base: HttpClient = {
      request(_method, path, init) {
        if (path === '/auth/login') {
          return Promise.resolve({
            status: 200,
            headers: { 'set-cookie': 'sid=one; Path=/' },
            body: { data: { csrf: 'tok1' } },
          })
        }
        seen.push(init?.headers ?? {})
        return Promise.resolve({
          status: 200,
          headers: { 'set-cookie': 'sid=two; Path=/' },
          body: { data: { csrf: 'tok2' } },
        })
      },
    }
    const session = await sessionLogin(base, { identifier: 'a', password: 'b' })
    await session.request('POST', '/session/role', { body: { role: 'x' } })
    await session.request('POST', '/session/role', { body: { role: 'y' } })
    expect(seen[0]).toMatchObject({ cookie: 'sid=one', 'x-csrf-token': 'tok1' })
    expect(seen[1]).toMatchObject({ cookie: 'sid=two', 'x-csrf-token': 'tok2' })
    expect(session.csrf).toBe('tok2')
  })
})

describe('target support for later cards', () => {
  const served = (key: string) => ({ ...fakeTarget(() => ({ status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'x' } } })), implements: (op: { key: string }) => op.key === key })

  it('stops a scenario at an operation the target does not serve and reports it, not a failure', async () => {
    const target = served('GET /session')
    const report = await runScenarios([call('GET', '/session'), call('GET', '/me')], { target, contract })
    expect(report.ok).toBe(true)
    expect(report.results[0]?.notImplemented).toEqual([])
    expect(report.results[1]?.notImplemented).toEqual(['GET /me'])
    expect([...report.notImplemented]).toEqual(['GET /me'])
    expect(report.touched.has('GET /me')).toBe(false)
    expect(formatRun(report)).toContain('1 not yet implemented')
  })

  it('lists unserved operations apart in the coverage report and leaves them out of the percentage', async () => {
    const target = served('GET /session')
    const report = await runScenarios([call('GET', '/session')], { target, contract })
    const cov = computeCoverage(contract, report, target)
    expect(cov.total).toBe(1)
    expect(cov.percent).toBe(100)
    expect(cov.notImplemented.length).toBe(contract.operations.length - 1)
    expect(cov.uncovered).toEqual([])
    expect(formatCoverage(cov, { list: true })).toContain('Not yet implemented:')
  })

  it('skips a scenario that is not for this target and counts it', async () => {
    const only: Scenario = { ...call('GET', '/session'), targets: ['api'] }
    const report = await runScenarios([only], { target: fakeTarget(() => ({})), contract })
    expect(report.results[0]?.notForTarget).toBe(true)
    expect(report.touched.size).toBe(0)
    expect(formatRun(report)).toContain('1 not for this target')
  })

  it('calls beginScenario before each scenario', async () => {
    const ids: string[] = []
    const target = { ...fakeTarget(() => ({})), beginScenario: (id: string) => void ids.push(id) }
    await runScenarios([call('GET', '/session'), call('GET', '/me')], { target, contract })
    expect(ids).toEqual(['GET /session', 'GET /me'])
  })
})

describe('unserved-operations gate', () => {
  const target = { implements: (op: { key: string }) => op.key === 'GET /session' }
  const mk = async () => {
    const t = { ...fakeTarget(() => ({ status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'x' } } })), ...target }
    const report = await runScenarios([call('GET', '/session')], { target: t, contract })
    return computeCoverage(contract, report, t)
  }

  it('is off by default, and CONFORMANCE_MAX_NOT_IMPLEMENTED / CONFORMANCE_REQUIRE_ALL fail above the count', async () => {
    const cov = await mk()
    const n = cov.notImplemented.length
    expect(n).toBeGreaterThan(0)
    expect(notImplementedFailure(cov, {})).toBeNull()
    expect(notImplementedFailure(cov, { CONFORMANCE_MAX_NOT_IMPLEMENTED: String(n) })).toBeNull()
    expect(notImplementedFailure(cov, { CONFORMANCE_MAX_NOT_IMPLEMENTED: String(n - 1) })).toMatch(/not yet implemented/)
    expect(notImplementedFailure(cov, { CONFORMANCE_REQUIRE_ALL: '1' })).toMatch(/not yet implemented/)
    expect(notImplementedFailure(cov, { CONFORMANCE_MAX_NOT_IMPLEMENTED: 'x' })).toMatch(/not a count/)
    // The percentage ignores unserved operations: 1 of 1 served is 100%.
    expect(cov.percent).toBe(100)
  })

  it('an empty route lookup is a failure, never 100%', async () => {
    const t = { ...fakeTarget(() => ({})), implements: () => false }
    const report = await runScenarios([], { target: t, contract })
    const cov = computeCoverage(contract, report, t)
    expect(cov.total).toBe(0)
    expect(cov.percent).toBe(0)
    expect(coverageFailure(cov, {})).toMatch(/serves no contract operation/)
  })

  it('a not-yet-implemented signal is not swallowed by helpers that call rethrowNotImplemented', () => {
    const signal = new NotImplementedSignal('GET /x')
    expect(() => rethrowNotImplemented(signal)).toThrow(signal)
    expect(() => rethrowNotImplemented(new Error('other'))).not.toThrow()
  })
})
