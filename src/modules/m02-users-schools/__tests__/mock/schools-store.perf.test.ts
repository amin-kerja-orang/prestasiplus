/**
 * F-23 query budget (build-plan v1.8 F-23 "Accept (v1.7)"; overview §6.6 v1.5): the school search
 * (`GET /api/schools/search`), the S9 list and the #43 options run in ≤ 50 ms on the 10,220-row
 * dataset.
 *
 * Timing uses F-09's shared paired-calibration harness (`@/mock/dataset/testing/perf-calibration`):
 * each case is paired with a floor pass, the ratio gate (`best ≤ cap × floor`) is always enforced,
 * and the 50 ms budget scales with the floor up to 1.5× — beyond that the budget gate is skipped
 * explicitly ("machine too loaded"). Search cases pair with the `native` floor. Caps come from 5
 * calibration runs with `suggestCaps`; see the harness header to re-tune them.
 */

import { beforeAll, describe, it } from 'vitest'

import { createClock } from '@/lib/time'
import {
  createPerfCalibration,
  type CaseOptions,
  type PerfCap,
} from '@/mock/dataset/testing/perf-calibration'
import { bootMock } from '@/mock/index'

import { schools } from '../../mock'

const BUDGET_MS = 50

/** Ratio caps (`best / paired floor`), from 5 runs with `suggestCaps`. */
const RATIO_CAPS: Readonly<Record<string, PerfCap>> = {
  'search "bangi" (default limit 20)': 0.051, // min 0.02558, median 0.03378, max 0.03980, 5 runs
  'search "sekolah kebangsaan" limit 15': 0.057, // min 0.03041, median 0.04191, max 0.04591, 5 runs
  'search code "JEA20"': 0.012, // min 0.00689, median 0.00748, max 0.00757, 5 runs
  'search "zzz"': 0.0053, // min 0.00322, median 0.00336, max 0.00440, 5 runs
  'search state Johor, empty query': 0.0013, // min 0.00069, median 0.00086, max 0.00089, 5 runs
  'search "kluang" + state Johor': 0.04, // min 0.02133, median 0.02830, max 0.03001, 5 runs
  'search fresh term': 0.056, // min 0.02978, median 0.04137, max 0.04339, 5 runs
  'search by id': 0.00016, // min 0.00009, median 0.00010, max 0.00012, 5 runs
  'S9 list page 1': 0.00078, // min 0.00046, median 0.00052, max 0.00059, 5 runs
  'S9 list last page': 0.0042, // min 0.00226, median 0.00307, max 0.00315, 5 runs
  'S9 list state Perlis': 0.0013, // min 0.00078, median 0.00084, max 0.00093, 5 runs
  'S9 list type SK page 100': 0.003, // min 0.00191, median 0.00198, max 0.00204, 5 runs
  'S9 list search "tinggi"': 0.029, // min 0.01749, median 0.01895, max 0.02110, 5 runs
  'S9 counts': 0.0013, // min 0.00077, median 0.00082, max 0.00088, 5 runs
  '#43 options (A→Z, 10,220)': 0.00039, // min 0.00022, median 0.00026, max 0.00027, 5 runs
  'get(id)': { cap: 0.00028, noisy: true, slackMs: 1 }, // min 0.00013, median 0.00017, max 0.00023, 5 runs — noisy: no 2x guarantee
  'summary(fixture 900001)': { cap: 0.00001, noisy: true, slackMs: 1 }, // min 0.00000, median 0.00000, max 0.00000, 5 runs — noisy: a sub-microsecond table read
}

const perf = createPerfCalibration({ prefix: 'M02 schools perf', caps: RATIO_CAPS })

beforeAll(async () => {
  perf.setup()
  await bootMock({
    mode: 'test',
    clock: createClock({ at: '2026-09-25T15:40:00+08:00' }),
    latencyMs: 0,
    onWarn: null,
  })
}, 120_000)

/** Ten distinct search terms, cycled so no call hits the query cache twice in a sample. */
const FRESH_TERMS = Array.from({ length: 10 }, (_, i) => `demo ${String(1000 + i * 731)}`)
let fresh = 0

const cases: [string, () => unknown, CaseOptions?][] = [
  ['search "bangi" (default limit 20)', () => schools.search({ q: 'bangi' }), 'native'],
  [
    'search "sekolah kebangsaan" limit 15',
    () => schools.search({ q: 'sekolah kebangsaan', limit: 15 }),
    'native',
  ],
  ['search code "JEA20"', () => schools.search({ q: 'JEA20' }), 'native'],
  ['search "zzz"', () => schools.search({ q: 'zzz' }), 'native'],
  ['search state Johor, empty query', () => schools.search({ state: 'Johor', limit: 15 })],
  [
    'search "kluang" + state Johor',
    () => schools.search({ q: 'kluang', state: 'Johor' }),
    'native',
  ],
  [
    'search fresh term',
    () => schools.search({ q: FRESH_TERMS[fresh++ % FRESH_TERMS.length] as string }),
    { kind: 'native', cycle: FRESH_TERMS.length },
  ],
  ['search by id', () => schools.search({ id: 8102 })],
  ['S9 list page 1', () => schools.list({})],
  ['S9 list last page', () => schools.list({ page: 341 })],
  ['S9 list state Perlis', () => schools.list({ state: 'Perlis' })],
  ['S9 list type SK page 100', () => schools.list({ type: 'SK', page: 100 })],
  ['S9 list search "tinggi"', () => schools.list({ search: 'tinggi' }), 'native'],
  ['S9 counts', () => schools.counts()],
  ['#43 options (A→Z, 10,220)', () => schools.options()],
  ['get(id)', () => schools.get(8880)],
  ['summary(fixture 900001)', () => schools.summary(900_001)],
]

describe('M02 schools query budget (10,220 rows)', () => {
  const results: Record<string, string> = {}

  for (const [label, fn, options] of cases) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results, options ?? 'js')
    }, 60_000)
  }

  it('reports timings', () => {
    perf.report('schools N=10,220', results)
  })
})

describe('calibration summary', () => {
  it('logs ratios and skips; fails when too many budget gates were skipped', () => {
    perf.logSummary()
    perf.assertSkipShare()
  })
})
