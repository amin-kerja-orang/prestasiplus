import {
  ContractIndex,
  computeCoverage,
  coverageFailure,
  formatCoverage,
  notImplementedFailure,
  runScenarios,
  type RunReport,
  type ScenarioResult,
} from '@pp/contract-tests'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { apiTarget, registeredRoutes, unknownRoutes } from './api-target'
import { bootConformanceApp, type ConformanceApp } from './boot'
import { API_KNOWN_MISMATCHES } from './known-mismatches'
import { apiScenarios } from './scenarios'

/**
 * BE-31: the contract conformance suite against the real API (Nest + supertest, a real Postgres from
 * Testcontainers, seeded). The same scenarios run against the frontend mock with `npm run conformance`.
 * Command every card runs: `npm run conformance:api`.
 *
 * One boot, then every scenario is its own test so a failure names the scenario. The last tests
 * check the run as a whole: that "not yet implemented" cannot hide a built domain, the reverse
 * route check, coverage and the two gates.
 */
const contract = ContractIndex.load()
const scenarios = apiScenarios(contract)

/** Domains whose controllers exist: none of their scenarios may stop at "not yet implemented". */
const BUILT_DOMAINS = new Set(['auth', 'session', 'users', 'schools', 'files'])
/** The run sends well over this many requests; far fewer means the scenarios were not really run. */
const MIN_REQUESTS = 150

let t: ConformanceApp
let routes: Set<string>
let target: ReturnType<typeof apiTarget>
const reports: RunReport[] = []

beforeAll(async () => {
  t = await bootConformanceApp()
  routes = registeredRoutes(t.app) // throws when the router stack cannot be read
  target = apiTarget(t.app, routes)
}, 120_000)

afterAll(async () => {
  await t.close()
})

describe('scenarios against the API', () => {
  it.each(scenarios.map((s) => [s.id, s] as const))('%s', async (_id, scenario) => {
    const known = API_KNOWN_MISMATCHES.filter((k) => k.scenario === scenario.id)
    const report = await runScenarios([scenario], { target, contract, knownMismatches: known })
    reports.push(report)
    const failures = (report.results[0]?.failures ?? []).map((v) => `[${v.kind}] ${v.message}`)
    expect(failures).toEqual([])
    expect(report.stale.map((s) => s.reason)).toEqual([])
  })
})

describe('the run as a whole', () => {
  const results = (): ScenarioResult[] => reports.flatMap((r) => r.results)

  it('ran every scenario and every known mismatch names a scenario that exists', () => {
    expect(reports).toHaveLength(scenarios.length)
    const ids = new Set(scenarios.map((s) => s.id))
    expect(API_KNOWN_MISMATCHES.filter((k) => !ids.has(k.scenario)).map((k) => k.scenario)).toEqual([])
  })

  it('the route lookup found routes, and every registered route is in the contract (reverse check)', () => {
    expect(routes.size).toBeGreaterThan(0)
    // A controller with a typo in its path would otherwise be skipped as "not yet implemented".
    expect(unknownRoutes(routes, contract)).toEqual([])
  })

  it('"not yet implemented" hides nothing in the built domains, and requests were really sent', () => {
    const hidden = results()
      .filter((r) => BUILT_DOMAINS.has(r.domain) && r.notImplemented.length > 0)
      .map((r) => `${r.id}: ${r.notImplemented.join(', ')}`)
    expect(hidden).toEqual([])
    for (const d of BUILT_DOMAINS) {
      expect(results().filter((r) => r.domain === d && !r.notForTarget).length, `scenarios in ${d}`).toBeGreaterThan(0)
    }
    const sent = reports.reduce((n, r) => n + r.requests, 0)
    expect(sent).toBeGreaterThanOrEqual(MIN_REQUESTS)
  })

  it('prints the coverage report and honours the coverage gates', () => {
    const touched = new Map<string, Set<number>>()
    for (const r of reports) for (const [k, v] of r.touched) touched.set(k, new Set([...(touched.get(k) ?? []), ...v]))
    const merged: RunReport = {
      target: target.name,
      results: results(),
      touched,
      requests: reports.reduce((n, r) => n + r.requests, 0),
      notImplemented: new Set(reports.flatMap((r) => [...r.notImplemented])),
      stale: [],
      ok: true,
    }
    const coverage = computeCoverage(contract, merged, target)
    const clean = merged.results.filter((r) => !r.notForTarget && r.violations.length === 0 && r.notImplemented.length === 0).length
    console.log(
      `Conformance run against api: ${String(merged.results.length)} scenarios, ${String(clean)} clean, ` +
        `${String(merged.results.filter((r) => r.known.length).length)} with known mismatches, ` +
        `${String(merged.results.filter((r) => r.notImplemented.length).length)} not yet implemented, ` +
        `${String(merged.requests)} requests sent`,
    )
    console.log(formatCoverage(coverage, { list: process.env.CONFORMANCE_LIST === '1' }))
    expect(coverage.total).toBeGreaterThan(0)
    expect(coverageFailure(coverage)).toBeNull()
    // The percentage counts implemented operations only; the lead sets CONFORMANCE_MAX_NOT_IMPLEMENTED
    // (or CONFORMANCE_REQUIRE_ALL=1) to also bound the operations that have no controller yet.
    expect(notImplementedFailure(coverage)).toBeNull()
  })
})
