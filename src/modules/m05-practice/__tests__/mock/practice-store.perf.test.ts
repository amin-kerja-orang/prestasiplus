/**
 * F-26 query budget (overview §6.6 v1.5; build plan v1.8 F-26 note): the answer log (478,499 rows)
 * is the largest dataset. Every screen and consumer read of the practice store uses ids, facets and
 * cheap fields only: ≤ 50 ms. The whole-log `match` scans (M11 / M17 distinct users) are the
 * declared `match`-with-`matchFields` exception: ≤ 100 ms.
 *
 * Timing uses F-09's paired-calibration harness: each case is paired with a floor pass, the ratio
 * gate (`best ≤ cap × floor`) is always enforced, and the budget scales with the floor up to 1.5×
 * (beyond that the budget gate is skipped explicitly; `assertSkipShare` fails the run when too many
 * are skipped). Caps from calibration runs with `suggestCaps` (see the harness header to re-tune).
 */

import { beforeAll, describe, it } from 'vitest'

import { createPerfCalibration, type PerfCap } from '@/mock/dataset/testing/perf-calibration'

import { practice, practiceAnswers } from '../../mock'
import { WINDOW_FROM } from '../../mock/datasets/calendar'
import { requirePracticePrime } from '../../mock/datasets/prime'
import { bootPractice } from './helpers'

const BUDGET_MS = 50
const SCAN_BUDGET_MS = 100

/** Ratio caps (`best / paired floor`), from 5 runs with `suggestCaps` (quiet machine, js floor ≈ 26 ms). */
const RATIO_CAPS: Readonly<Record<string, PerfCap>> = {
  'Q-ANS-ALL': 0.00039, // min 0.00023, median 0.00026, max 0.00028, 5 runs
  'Q-ANS-CORRECT': 0.00086, // min 0.00050, median 0.00057, max 0.00060, 5 runs
  'Q-ANS-SEG 7d': { cap: 0.12, noisy: true, slackMs: 1 }, // min 0.07721, median 0.07955, max 0.08037, 5 runs — noisy: a native value-column scan, the JS floor over-scales it under load
  'Q-ANS-SEG school week': 0.0015, // min 0.00099, median 0.00100, max 0.00105, 5 runs
  'Q-ANS-P month': { cap: 0.14, noisy: true, slackMs: 1 }, // min 0.08418, median 0.08817, max 0.09579, 5 runs — noisy: as Q-ANS-SEG 7d
  'Q-ANS-USER admin': 0.07, // min 0.04446, median 0.04638, max 0.04867, 5 runs
  'Q-SESS-ALL': 0.00045, // min 0.00027, median 0.00030, max 0.00031, 5 runs
  'Q-SESS-USER admin': 0.0054, // min 0.00326, median 0.00354, max 0.00382, 5 runs
  'Q-SESS-P week': 0.0084, // min 0.00509, median 0.00558, max 0.00575, 5 runs
  'Q-SESS-LINK 7103': 0.00039, // min 0.00023, median 0.00025, max 0.00026, 5 runs
  'history admin (S9)': 0.015, // min 0.00925, median 0.00968, max 0.01035, 5 runs
  'history pelajarmaju today (M14)': 0.015, // min 0.00923, median 0.00950, max 0.01040, 5 runs
  'history heaviest generated user': 0.027, // min 0.01739, median 0.01754, max 0.01763, 5 runs
  '#23 historyPage admin': 0.013, // min 0.00808, median 0.00862, max 0.00896, 5 runs
  'answers pelajarmaju today (M14)': 0.2, // min 0.12870, median 0.13320, max 0.13710, 5 runs
  'answers admin (S8)': 0.19, // min 0.11680, median 0.12060, max 0.12380, 5 runs
  'answers heaviest generated user, 3 months': 0.24, // min 0.15740, median 0.15970, max 0.17180, 5 runs
  'queue admin (S6)': 0.0025, // min 0.00160, median 0.00166, max 0.00175, 5 runs
  'mastery pelajar (S12)': { cap: 0.000049, noisy: true, slackMs: 1 }, // min 0.00003, median 0.00003, max 0.00004, 5 runs — noisy: a ~1 µs case
  'chapterStats pelajarmaju Bab 1 (S5)': 0.21, // min 0.13360, median 0.13670, max 0.14820, 5 runs
  'session get generated': { cap: 0.00002, noisy: true, slackMs: 1 }, // min 0.00001, median 0.00001, max 0.00001, 5 runs — noisy: a sub-µs case
  'sessionAnswers generated': 0.00047, // min 0.00030, median 0.00031, max 0.00033, 5 runs
  'Q-SESS-MEAN-ACC all': 0.089, // min 0.05744, median 0.05927, max 0.06532, 5 runs
  'distinct users P week (M17 engaged)': 0.25, // min 0.14370, median 0.16090, max 0.16360, 5 runs
  'distinct users school (M11 Aktif)': 0.16, // min 0.09194, median 0.10130, max 0.10200, 5 runs
  'distinct session users week (M08 S20)': { cap: 0.019, noisy: true, slackMs: 1 }, // min 0.01189, median 0.01211, max 0.01404, 5 runs — noisy: sub-ms; re-check after F09-7
}

const perf = createPerfCalibration({ prefix: 'M05 perf', caps: RATIO_CAPS })

/** The generated user with the most sessions (the heaviest per-user read). */
let heavy = 0

beforeAll(async () => {
  await bootPractice()
  const p = requirePracticePrime()
  const n = new Map<number, number>()
  for (let k = 1; k < p.sUser.length; k++) {
    const u = p.sUser[k] as number
    if (u > 0) n.set(u, (n.get(u) ?? 0) + 1)
  }
  heavy = [...n].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0
  perf.setup()
}, 120_000)

const CASES: readonly (readonly [string, () => unknown, number?])[] = [
  ['Q-ANS-ALL', () => practiceAnswers.count('Q-ANS-ALL')],
  ['Q-ANS-CORRECT', () => practiceAnswers.count('Q-ANS-CORRECT')],
  ['Q-ANS-SEG 7d', () => practiceAnswers.count('Q-ANS-SEG', '7d')],
  ['Q-ANS-SEG school week', () => practiceAnswers.count('Q-ANS-SEG', '', 8080, 18)],
  ['Q-ANS-P month', () => practiceAnswers.count('Q-ANS-P', 'month')],
  ['Q-ANS-USER admin', () => practiceAnswers.count('Q-ANS-USER', 1)],
  ['Q-SESS-ALL', () => practice.count('Q-SESS-ALL')],
  ['Q-SESS-USER admin', () => practice.count('Q-SESS-USER', 1)],
  ['Q-SESS-P week', () => practice.count('Q-SESS-P', 'week')],
  ['Q-SESS-LINK 7103', () => practice.count('Q-SESS-LINK', 7103)],
  ['history admin (S9)', () => practice.history(1)],
  ['history pelajarmaju today (M14)', () => practice.history(4, { date: '2026-09-25' })],
  ['history heaviest generated user', () => practice.history(heavy)],
  [
    '#23 historyPage admin',
    () => practice.historyPage(1, { modes: ['past_year', 'latih_tubi', 'ramalan'] }),
  ],
  ['answers pelajarmaju today (M14)', () => practice.answers(4, { date: '2026-09-25' })],
  ['answers admin (S8)', () => practice.answers(1)],
  [
    'answers heaviest generated user, 3 months',
    () => practice.answers(heavy, { from: WINDOW_FROM.m3 }),
  ],
  ['queue admin (S6)', () => practice.queue(1)],
  ['mastery pelajar (S12)', () => practice.mastery(2)],
  ['chapterStats pelajarmaju Bab 1 (S5)', () => practice.chapterStats(4, 1)],
  ['session get generated', () => practice.session('g12345')],
  ['sessionAnswers generated', () => practice.sessionAnswers('g12345')],
  ['Q-SESS-MEAN-ACC all', () => practice.sessionMeanAccuracy()],
  [
    'distinct users P week (M17 engaged)',
    () => practice.distinctUsers({ by: 'answers', population: 'P', from: WINDOW_FROM.week }),
    SCAN_BUDGET_MS,
  ],
  [
    'distinct users school (M11 Aktif)',
    () => practice.distinctUsers({ by: 'answers', population: 'segment', schoolId: 8080 }),
    SCAN_BUDGET_MS,
  ],
  [
    'distinct session users week (M08 S20)',
    () => practice.distinctUsers({ by: 'sessions', from: WINDOW_FROM.week }),
  ],
]

describe('M05 query budget', () => {
  const results: Record<string, string> = {}
  for (const [label, fn, budget] of CASES) {
    it(`${label} ≤ ${String(budget ?? BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, budget ?? BUDGET_MS, results)
    })
  }
  it('reports timings', () => perf.report('M05 perf', results))
})

describe('regression proof (F09-5)', () => {
  it('the ratio gate catches a 2× slower whole-log scan (the heaviest case)', (ctx) => {
    perf.proveRegression(ctx, 'distinct users P week (M17 engaged)', () =>
      practice.distinctUsers({ by: 'answers', population: 'P', from: WINDOW_FROM.week }),
    )
  })
})

describe('calibration summary', () => {
  it('logs ratios and skips; fails when too loaded', () => {
    perf.logSummary()
    perf.assertSkipShare()
  })
})
