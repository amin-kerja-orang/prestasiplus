/**
 * F-26b query budget (overview §6.6 v1.5; SRS M14 NFR-M14-02): every M14 screen and consumer read
 * of the `wallets` (2,255) and `coinLedger` (52,964) datasets runs in ≤ 50 ms — facet, id,
 * cheap-field and `search` shapes only. S4 #28 and S5 #30 are the NFR cases.
 *
 * Timing uses F-09's paired-calibration harness: each case is paired with a floor pass, the ratio
 * gate (`best ≤ cap × floor`) is always enforced, and the 50 ms budget scales with the floor up to
 * 1.5× (beyond that the budget gate is skipped explicitly; `assertSkipShare` fails the run when too
 * many are skipped).
 */

import { beforeAll, describe, it } from 'vitest'

import { createPerfCalibration, type PerfCap } from '@/mock/dataset/testing/perf-calibration'

import {
  achievements,
  challenges,
  coinLedger,
  gamification,
  streak,
  teacherWallet,
  wallet,
} from '../../mock'
import { bootM14 } from './helpers'

const BUDGET_MS = 50

/**
 * Ratio caps (`best / paired floor`), from 5 runs with `suggestCaps` (recalibrated after the review
 * follow-ups: the summary cases now include the per-user ledger scan, ~0.2–0.6 ms).
 */
const RATIO_CAPS: Readonly<Record<string, PerfCap>> = {
  '#1 chips (summary + streak)': 0.034, // min 0.02136, median 0.02262, max 0.02386, 5 runs
  '#2 wallet summary (generated user)': 0.029, // min 0.01720, median 0.01908, max 0.02015, 5 runs
  'S4 page 1 (lifetime)': 0.00038, // min 0.00023, median 0.00025, max 0.00027, 5 runs
  'S4 last page 113': 0.00026, // min 0.00016, median 0.00017, max 0.00018, 5 runs
  'S4 tier bronze page 50': 0.00035, // min 0.00020, median 0.00023, max 0.00024, 5 runs
  'S4 sort token_balance': 0.00032, // min 0.00020, median 0.00021, max 0.00023, 5 runs
  'S4 search name': 0.031, // min 0.01958, median 0.02023, max 0.02199, 5 runs
  'S4 search broad (pelajar)': 1.2, // min 0.74020, median 0.78230, max 0.83990, 5 runs
  'M05 onSessionCompleted': 0.023, // min 0.01366, median 0.01483, max 0.01628, 5 runs
  'S14 leaderboard top 50': 0.00039, // min 0.00021, median 0.00027, max 0.00028, 5 runs
  'S1 Q-SYILING-DIJANA': 0.013, // min 0.00760, median 0.00826, max 0.00874, 5 runs
  'S1 Q-TIER counts': 0.00019, // min 0.00011, median 0.00012, max 0.00013, 5 runs
  'S1 recent 10': 0.0026, // min 0.00147, median 0.00171, max 0.00177, 5 runs
  'S1 tokens converted': 0.000081, // min 0.00005, median 0.00005, max 0.00006, 5 runs
  'S5 page 1': 0.0025, // min 0.00164, median 0.00166, max 0.00169, 5 runs
  'S5 page 1000': 0.099, // min 0.06361, median 0.06586, max 0.06692, 5 runs
  'S5 last page 2119': 0.22, // min 0.13410, median 0.14140, max 0.14710, 5 runs
  'S5 type convert': 0.0014, // min 0.00085, median 0.00091, max 0.00099, 5 runs
  'S5 date range': 0.19, // min 0.12010, median 0.12220, max 0.13100, 5 runs
  'S5 Q-TX earn': 0.000095, // min 0.00006, median 0.00006, max 0.00007, 5 runs
  'S17 admin ledger': 0.044, // min 0.02581, median 0.02874, max 0.03009, 5 runs
  'S17 generated user ledger': 0.045, // min 0.02753, median 0.02944, max 0.03256, 5 runs
  'S13 challenges today': 0.00037, // min 0.00022, median 0.00024, max 0.00027, 5 runs
  'S15 achievements': 0.00037, // min 0.00023, median 0.00025, max 0.00027, 5 runs
  'S1 daily finishers': 0.00024, // min 0.00015, median 0.00016, max 0.00016, 5 runs
  'S22 teacher leaderboard': 0.0081, // min 0.00526, median 0.00539, max 0.00542, 5 runs
}

const perf = createPerfCalibration({ prefix: 'M14 perf', caps: RATIO_CAPS })

beforeAll(async () => {
  await bootM14()
  perf.setup()
}, 120_000)

let sessionSeq = 0

const CASES: readonly (readonly [string, () => unknown])[] = [
  ['#1 chips (summary + streak)', () => [wallet.summary(2), streak.get(2)]],
  ['#2 wallet summary (generated user)', () => wallet.summary(4500)],
  ['S4 page 1 (lifetime)', () => wallet.adminList({})],
  ['S4 last page 113', () => wallet.adminList({ page: 113 })],
  ['S4 tier bronze page 50', () => wallet.adminList({ tier: 'bronze', page: 50 })],
  ['S4 sort token_balance', () => wallet.adminList({ sort: 'token_balance' })],
  ['S4 search name', () => wallet.adminList({ search: 'Murid Demo 40' })],
  // A broad term: ~3,400 matching users, intersected with the 2,255 wallets.
  ['S4 search broad (pelajar)', () => wallet.adminList({ search: 'pelajar' })],
  // M05 BR-31 step 6: one full completion (fresh session id each call; writes rows).
  [
    'M05 onSessionCompleted',
    () =>
      gamification.onSessionCompleted({
        userId: 3,
        sessionId: 'perf-' + String(++sessionSeq),
        mode: 'random',
        correct: 6,
        total: 10,
        timeSpent: 300,
        completedAt: '2026-09-25T15:00:00+08:00',
        pointsEarned: 60,
      }),
  ],
  ['S14 leaderboard top 50', () => wallet.leaderboard()],
  ['S1 Q-SYILING-DIJANA', () => wallet.syilingGenerated()],
  [
    'S1 Q-TIER counts',
    () => ['bronze', 'silver', 'gold', 'platinum'].map((t) => wallet.count('Q-TIER', t)),
  ],
  ['S1 recent 10', () => coinLedger.recent(10)],
  ['S1 tokens converted', () => coinLedger.tokensConverted()],
  ['S5 page 1', () => coinLedger.adminList({})],
  ['S5 page 1000', () => coinLedger.adminList({ page: 1000 })],
  ['S5 last page 2119', () => coinLedger.adminList({ page: 2119 })],
  ['S5 type convert', () => coinLedger.adminList({ type: 'convert' })],
  ['S5 date range', () => coinLedger.adminList({ dateFrom: '2026-02-26', dateTo: '2026-02-27' })],
  ['S5 Q-TX earn', () => coinLedger.count('Q-TX', 'earn')],
  ['S17 admin ledger', () => coinLedger.forUser(1)],
  ['S17 generated user ledger', () => coinLedger.forUser(4074)],
  ['S13 challenges today', () => challenges.today(2)],
  ['S15 achievements', () => achievements.forUser(4)],
  ['S1 daily finishers', () => gamification.dailyFinishers()],
  ['S22 teacher leaderboard', () => teacherWallet.leaderboard('global', 1)],
]

describe('M14 query budget', () => {
  const results: Record<string, string> = {}
  for (const [label, fn] of CASES) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results)
    })
  }
  it('reports timings', () => perf.report('M14 perf', results))
})

describe('regression proof (F09-5)', () => {
  it('the ratio gate catches a 2× slower S5 last page (the heaviest NFR-M14-02 case)', (ctx) => {
    perf.proveRegression(ctx, 'S5 last page 2119', () => coinLedger.adminList({ page: 2119 }))
  })
})

describe('calibration summary', () => {
  it('logs ratios and skips; fails when too loaded', () => {
    perf.logSummary()
    perf.assertSkipShare()
  })
})
