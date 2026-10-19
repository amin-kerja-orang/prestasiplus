/**
 * BE-31: the conformance suite run against the frontend mock (full registry boot, ~1 minute).
 * The mock is not expected to match the contract everywhere (ADR-0018 item 6: numeric ids, `Z`
 * instants, Bearer sessions); each mismatch found is listed in `known-mismatches.ts` and reported
 * apart. A NEW mismatch fails this test, and so does a listed one that no longer occurs.
 *
 * `CONFORMANCE_DUMP=<file>` writes the full result as JSON (used to refresh the known list).
 * `CONFORMANCE_MIN_COVERAGE=<percent>` is the coverage threshold (default 0).
 */

import { writeFileSync } from 'node:fs'

import { beforeAll, describe, expect, it } from 'vitest'

import { createClock } from '@/lib/time'
import { CLOCK_ANCHOR_ISO } from '@/lib/time'
import { bootMock, type MockRuntime } from '@/mock/index'

import {
  ContractIndex,
  allScenarios,
  computeCoverage,
  coverageFailure,
  formatCoverage,
  formatRun,
  runScenarios,
  type RunReport,
} from '../../src'
import { KNOWN_MISMATCHES } from '../known-mismatches'
import { mockTarget } from '../mock-client'

const contract = ContractIndex.load()
let runtime: MockRuntime
let report: RunReport

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
  report = await runScenarios(allScenarios(contract), {
    target: mockTarget(runtime.transport, { raw: process.env.MOCK_RAW === '1' }),
    contract,
    knownMismatches: KNOWN_MISMATCHES,
  })
  const dump = process.env.CONFORMANCE_DUMP
  if (dump) {
    const rows = report.results.map((r) => ({ id: r.id, violations: r.violations }))
    writeFileSync(dump, JSON.stringify(rows, null, 2))
  }
}, 180_000)

describe('conformance suite against the frontend mock', () => {
  it('has no new mismatch and no stale known mismatch', () => {
    console.log(formatRun(report))
    const unexpected = report.results.flatMap((r) => r.failures.map((v) => `${r.id}: ${v.message}`))
    expect(unexpected).toEqual([])
    expect(report.stale.map((s) => s.scenario)).toEqual([])
  })

  it('prints the coverage report and honours CONFORMANCE_MIN_COVERAGE', () => {
    const coverage = computeCoverage(contract, report)
    console.log(formatCoverage(coverage))
    expect(coverageFailure(coverage)).toBeNull()
  })
})
