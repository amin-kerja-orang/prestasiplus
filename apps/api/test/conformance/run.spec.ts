import {
  ContractIndex,
  computeCoverage,
  coverageFailure,
  formatCoverage,
  formatRun,
  runScenarios,
  type RunReport,
} from '@pp/contract-tests'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { apiTarget } from './api-target'
import { bootConformanceApp, type ConformanceApp } from './boot'
import { API_KNOWN_MISMATCHES } from './known-mismatches'
import { apiScenarios } from './scenarios'

/**
 * BE-31: the contract conformance suite against the real API (Nest + supertest, a real Postgres from
 * Testcontainers, seeded). The same scenarios run against the frontend mock with `npm run conformance`.
 * Command every card runs: `npm run conformance:api`.
 */
const contract = ContractIndex.load()
let t: ConformanceApp
let report: RunReport
let coverage: ReturnType<typeof computeCoverage>

beforeAll(async () => {
  t = await bootConformanceApp()
  const target = apiTarget(t.app)
  report = await runScenarios(apiScenarios(contract), {
    target,
    contract,
    knownMismatches: API_KNOWN_MISMATCHES,
  })
  coverage = computeCoverage(contract, report, target)
}, 120_000)

afterAll(async () => {
  await t.close()
})

describe('contract conformance against the API', () => {
  it('has no failing scenario and no stale known mismatch', () => {
    console.log(formatRun(report))
    const failures = report.results.flatMap((r) => r.failures.map((v) => `${r.id}: [${v.kind}] ${v.message}`))
    expect(failures).toEqual([])
    expect(report.stale.map((s) => s.scenario)).toEqual([])
  })

  it('prints the coverage report and honours CONFORMANCE_MIN_COVERAGE', () => {
    console.log(formatCoverage(coverage, { list: process.env.CONFORMANCE_LIST === '1' }))
    expect(coverageFailure(coverage)).toBeNull()
  })
})
