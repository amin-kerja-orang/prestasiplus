/**
 * F-23 query budget (build-plan v1.8 F-23 "Accept (v1.7)"; overview §6.6 v1.5): the users list
 * filters (M02 S1 #1: role, school, active, name / e-mail search, pages), the login lookup and the
 * M11 / M17 counts run in ≤ 50 ms on the 5,159-row dataset.
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

import { users } from '../../mock'

const BUDGET_MS = 50

/** Ratio caps (`best / paired floor`), from 5 runs with `suggestCaps`. */
const RATIO_CAPS: Readonly<Record<string, PerfCap>> = {
  'S1 page 1 (newest first)': 0.012, // min 0.00751, median 0.00773, max 0.00834, 5 runs
  'S1 last page (207)': 0.17, // min 0.09052, median 0.09295, max 0.14050, 5 runs
  'S1 role student page 100': 0.076, // min 0.04435, median 0.05020, max 0.05442, 5 runs
  'S1 role jpn_officer': 0.0039, // min 0.00209, median 0.00264, max 0.00276, 5 runs
  'S1 inactive page 58': 0.042, // min 0.02602, median 0.02778, max 0.02983, 5 runs
  'S1 school 8082': 0.0042, // min 0.00268, median 0.00279, max 0.00286, 5 runs
  'S1 school + role + active': 0.0065, // min 0.00406, median 0.00432, max 0.00479, 5 runs
  'S1 search name "Demo 0012"': { cap: 0.097, noisy: true, slackMs: 1 }, // min 0.04711, median 0.06401, max 0.07551, 5 runs — noisy: no 2x guarantee
  'S1 search e-mail "@prestasiplus.my"': 0.063, // min 0.03348, median 0.04051, max 0.05201, 5 runs
  'S1 search + role': 0.027, // min 0.01568, median 0.01765, max 0.02123, 5 runs
  'S1 search fresh term': 0.07, // min 0.04069, median 0.04558, max 0.05827, 5 runs
  'S1 role cards': 0.0034, // min 0.00198, median 0.00222, max 0.00249, 5 runs
  'findByEmail (login)': 0.015, // min 0.00751, median 0.00768, max 0.01179, 5 runs
  'findByEmail generated': { cap: 0.016, noisy: true, slackMs: 1 }, // min 0.00755, median 0.00861, max 0.01290, 5 runs — noisy: no 2x guarantee
  'search("adam")': { cap: 0.076, noisy: true, slackMs: 1 }, // min 0.03456, median 0.05001, max 0.06148, 5 runs — noisy: no 2x guarantee
  'schools with users (S1 filter)': 0.00078, // min 0.00048, median 0.00052, max 0.00053, 5 runs
  'M11 register count per school': 0.00096, // min 0.00059, median 0.00064, max 0.00071, 5 runs
  'M17 P outside fixture schools': 0.0018, // min 0.00114, median 0.00119, max 0.00147, 5 runs
  'M18 lastActiveAt null at 8880': 0.0016, // min 0.00096, median 0.00103, max 0.00104, 5 runs
  'get(id)': { cap: 0.00027, noisy: true, slackMs: 1 }, // min 0.00013, median 0.00017, max 0.00021, 5 runs — noisy: no 2x guarantee
}

const perf = createPerfCalibration({ prefix: 'M01 users perf', caps: RATIO_CAPS })

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
const FRESH_TERMS = Array.from({ length: 10 }, (_, i) => `pelajar00${String(1000 + i * 37)}`)
let fresh = 0

const cases: [string, () => unknown, CaseOptions?][] = [
  ['S1 page 1 (newest first)', () => users.adminList({})],
  ['S1 last page (207)', () => users.adminList({ page: 207 })],
  ['S1 role student page 100', () => users.adminList({ role: 'student', page: 100 })],
  ['S1 role jpn_officer', () => users.adminList({ role: 'jpn_officer' })],
  ['S1 inactive page 58', () => users.adminList({ isActive: false, page: 58 })],
  ['S1 school 8082', () => users.adminList({ schoolId: 8082 })],
  [
    'S1 school + role + active',
    () => users.adminList({ schoolId: 8102, role: 'student', isActive: true, page: 5 }),
  ],
  ['S1 search name "Demo 0012"', () => users.adminList({ search: 'Demo 0012' }), 'native'],
  [
    'S1 search e-mail "@prestasiplus.my"',
    () => users.adminList({ search: '@prestasiplus.my' }),
    'native',
  ],
  ['S1 search + role', () => users.adminList({ search: 'guru', role: 'teacher' }), 'native'],
  [
    'S1 search fresh term',
    () => users.adminList({ search: FRESH_TERMS[fresh++ % FRESH_TERMS.length] as string }),
    { kind: 'native', cycle: FRESH_TERMS.length },
  ],
  ['S1 role cards', () => users.roleCounts()],
  ['findByEmail (login)', () => users.findByEmail('Pelajar@Demo.Test'), 'native'],
  ['findByEmail generated', () => users.findByEmail('pelajar004000@demo.test'), 'native'],
  ['search("adam")', () => users.search('adam'), 'native'],
  ['schools with users (S1 filter)', () => users.schoolsWithUsers()],
  ['M11 register count per school', () => users.count('Q-M11-T45', 8082)],
  [
    'M17 P outside fixture schools',
    () => users.outsideFixtureSchools({ role: 'student', isActive: true }),
  ],
  [
    'M18 lastActiveAt null at 8880',
    () => users.countWhere({ role: 'student', schoolId: 8880, lastActiveAt: { isNull: true } }),
  ],
  ['get(id)', () => users.get(2008)],
]

describe('M01 users query budget (5,159 rows)', () => {
  const results: Record<string, string> = {}

  for (const [label, fn, options] of cases) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results, options ?? 'js')
    }, 60_000)
  }

  it('reports timings', () => {
    perf.report('users N=5,159', results)
  })
})

describe('calibration summary', () => {
  it('logs ratios and skips; fails when too many budget gates were skipped', () => {
    perf.logSummary()
    perf.assertSkipShare()
  })
})
