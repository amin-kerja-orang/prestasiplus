/**
 * F-25 query budget (overview §6.6 v1.5, build plan v1.7): every M04 screen query shape and every
 * consumer read of the question stores runs in ≤ 50 ms on the full 466,041-row dataset — facet,
 * id, cheap-field and `search` shapes only (no screen query derives every row).
 *
 * Timing uses F-09's shared paired-calibration harness (`@/mock/dataset/testing/perf-calibration`):
 * each case is paired with a floor pass, the ratio gate (`best ≤ cap × floor`) is always enforced,
 * and the 50 ms budget scales with the floor up to 1.5× — beyond that the budget gate is skipped
 * explicitly ("machine too loaded"). Caps were set from 5 calibration runs with `suggestCaps`
 * (native floor for the search cases; noisy caps carry a 1 ms slack); see the harness header to
 * re-tune them.
 */

import { beforeAll, describe, it } from 'vitest'

import { createClock } from '@/lib/time'
import {
  createPerfCalibration,
  type FloorKind,
  type PerfCap,
} from '@/mock/dataset/testing/perf-calibration'
import { mulberry32 } from '@/mock/determinism'
import { defineMockCore } from '@/mock/define'
import { bootMock } from '@/mock/index'

import { questions, reports, structured } from '../../mock'
import { questionsDataset } from '../../mock/datasets/questions'

const BUDGET_MS = 50

/** Ratio caps (`best / paired floor`), from 5 runs with `suggestCaps`. */
const RATIO_CAPS: Readonly<Record<string, PerfCap>> = {
  'S1 page 1 (newest first)': 0.016, // median 0.00872, max 0.01209, 5 runs
  'S1 page 1000': 0.061, // median 0.03348, max 0.03932, 5 runs
  'S1 last page': 1.1, // median 0.60720, max 0.62790, 5 runs
  'S1 subject + level': 0.021, // median 0.01129, max 0.01343, 5 runs
  'S1 difficulty 1': 0.028, // median 0.01546, max 0.01862, 5 runs
  'S1 status archived': 0.026, // median 0.01416, max 0.01676, 5 runs
  'S1 dskp untagged': 0.02, // median 0.01109, max 0.01140, 5 runs
  'S1 compliance missing_source': { cap: 0.028, noisy: true, slackMs: 1 }, // median 0.01133, max 0.01841, 5 runs — noisy: no 2x guarantee
  'S1 compliance verified_generated': 0.023, // median 0.01224, max 0.01240, 5 runs
  'S1 source trial': 0.027, // median 0.01468, max 0.01621, 5 runs
  'S1 search rare term': 1.8, // median 1.00000, max 1.21400, 5 runs
  'S1 search "satelit"': 0.4, // median 0.22000, max 0.25630, 5 runs
  'S1 search "pecahan" + subject + page 5': 0.44, // median 0.24350, max 0.25930, 5 runs
  'S1 search "apakah"': 1.4, // median 0.72320, max 0.73200, 5 runs
  'S1 search "apakah" + subject + page 5': 1.4, // median 0.72250, max 0.82150, 5 runs
  'S1 tiles: Q-ALL by subject': 0.02, // median 0.01107, max 0.01454, 5 runs
  'S1 tiles: Q-APPROVED by subject': 0.024, // median 0.01320, max 0.01957, 5 runs
  'S3 get(id)': 0.000077, // median 0.00004, max 0.00005, 5 runs
  'S3 get(anchor)': 0.000075, // median 0.00004, max 0.00005, 5 runs
  'S6 qualityStats': 1.2, // median 0.64340, max 0.77190, 5 runs
  'S6 bucket counts': 0.012, // median 0.00622, max 0.00693, 5 runs
  'S11 flagged MCQ page 1': 0.017, // median 0.00938, max 0.01304, 5 runs
  'S11 flagged subject page 3': 0.022, // median 0.01202, max 0.01383, 5 runs
  'S11 flagged by creators': 0.024, // median 0.01330, max 0.01661, 5 runs
  'count Q-ELIGIBLE(subject)': 0.031, // median 0.01711, max 0.02007, 5 runs
  'groupCount Q-ACTIVE by level': 0.025, // median 0.01352, max 0.01552, 5 runs
  'count Q-DIFFICULTY': 0.017, // median 0.00921, max 0.01015, 5 runs
  'M05 practiceQuery (10 of MATH D1)': 0.11, // median 0.05805, max 0.06191, 5 runs
  'M05 chapter draw': 0.095, // median 0.05233, max 0.05667, 5 runs
  'M06 spmPool total': 0.032, // median 0.01735, max 0.02521, 5 runs
  'M06 spmPool sample 40': 0.15, // median 0.08182, max 0.11220, 5 runs
  'M06 spmPool page 10': 0.073, // median 0.04030, max 0.04271, 5 runs
  'M08 spAvailable': 0.025, // median 0.01366, max 0.01873, 5 runs
  'M10 contributions page 1': 0.28, // median 0.15380, max 0.20230, 5 runs
  'M10 contributions page 500': 0.27, // median 0.14520, max 0.17400, 5 runs
  'M10 databank page 1': 0.11, // median 0.05621, max 0.06662, 5 runs
  'M10 databank search': 0.82, // median 0.45540, max 0.51800, 5 runs
  'M11 chapterLabel count': 0.29, // median 0.15710, max 0.19180, 5 runs
  'M16 sampleKeyless': { cap: 0.12, noisy: true, slackMs: 1 }, // median 0.04867, max 0.07919, 5 runs — noisy: no 2x guarantee
  'M16 jutawanSample': 0.021, // median 0.01159, max 0.01261, 5 runs
  'M17 Q-M17-COV by subject': 0.041, // median 0.02258, max 0.02631, 5 runs
  'M17 teacherContributions': 0.024, // median 0.01288, max 0.01447, 5 runs
  'M07 PKSK list page 39': 0.093, // median 0.05150, max 0.05839, 5 runs
  'M07 PKSK search': 0.4, // median 0.21840, max 0.24360, 5 runs
  'S8 structured page 1': 0.0029, // median 0.00159, max 0.00179, 5 runs
  'S8 structured filter': 0.0022, // median 0.00118, max 0.00152, 5 runs
  'M05 structured visible': { cap: 0.0025, noisy: true, slackMs: 1 }, // median 0.00108, max 0.00165, 5 runs — noisy: no 2x guarantee
  'M10 structured list (updatedAt)': 0.0005, // median 0.00028, max 0.00030, 5 runs
  'S7 reports': { cap: 0.000078, noisy: true, slackMs: 1 }, // median 0.00003, max 0.00005, 5 runs — noisy: no 2x guarantee
}

const perf = createPerfCalibration({ prefix: 'M04 perf', caps: RATIO_CAPS })

beforeAll(async () => {
  perf.setup()
  await bootMock({
    mode: 'test',
    core: defineMockCore({}),
    clock: createClock({ at: '2026-09-25T15:40:00+08:00' }),
    latencyMs: 0,
    onWarn: null,
  })
}, 120_000)

const lastPage = Math.ceil(465_278 / 20)

/** `[label, fn, floor kind]`: native-string-search cases pair with the `native` floor. */
const cases: [string, () => unknown, FloorKind?][] = [
  // S1 Pengurusan Soalan (#1, #2): list, filters, search, pager, tiles.
  ['S1 page 1 (newest first)', () => questions.adminList({})],
  ['S1 page 1000', () => questions.adminList({ page: 1000 })],
  ['S1 last page', () => questions.adminList({ page: lastPage })],
  ['S1 subject + level', () => questions.adminList({ subjectId: 4, educationLevelId: 11 })],
  ['S1 difficulty 1', () => questions.adminList({ difficultyLevel: 1, page: 50 })],
  ['S1 status archived', () => questions.adminList({ status: 'archived', page: 100 })],
  ['S1 dskp untagged', () => questions.adminList({ dskpFilter: 'untagged' })],
  [
    'S1 compliance missing_source',
    () => questions.adminList({ complianceFilter: 'missing_source' }),
  ],
  [
    'S1 compliance verified_generated',
    () => questions.adminList({ complianceFilter: 'verified_generated' }),
  ],
  ['S1 source trial', () => questions.adminList({ sourceFilter: 'trial', page: 20 })],
  ['S1 search rare term', () => questions.adminList({ search: 'Topup Sains T5 Bab 9' }), 'native'],
  ['S1 search "satelit"', () => questions.adminList({ search: 'satelit' }), 'native'],
  [
    'S1 search "pecahan" + subject + page 5',
    () => questions.adminList({ search: 'pecahan', subjectId: 3, page: 5 }),
    'native',
  ],
  ['S1 search "apakah"', () => questions.adminList({ search: 'apakah' }), 'native'],
  [
    'S1 search "apakah" + subject + page 5',
    () => questions.adminList({ search: 'apakah', subjectId: 3, page: 5 }),
    'native',
  ],
  ['S1 tiles: Q-ALL by subject', () => questions.groupCount('Q-ALL', 'subjectId')],
  ['S1 tiles: Q-APPROVED by subject', () => questions.groupCount('Q-APPROVED', 'subjectId')],
  // S3/S4 detail.
  ['S3 get(id)', () => questions.get(300_001)],
  ['S3 get(anchor)', () => questions.get(564159)],
  // S6 quality (cheap-field aggregate over 147,026 scored rows).
  ['S6 qualityStats', () => questions.qualityStats()],
  ['S6 bucket counts', () => questions.countWhere({ qualityBucket: 'le50', legacyGeneric: false })],
  // S11 diagram audit.
  ['S11 flagged MCQ page 1', () => questions.flagged({})],
  ['S11 flagged subject page 3', () => questions.flagged({ subjectId: 11, page: 3 })],
  ['S11 flagged by creators', () => questions.flagged({ creatorIds: [5801] })],
  // Consumers: M01/M03/M05 counts, M05/M06 practice draws, M08, M10, M11, M16, M07, M17.
  ['count Q-ELIGIBLE(subject)', () => questions.count('Q-ELIGIBLE', 3)],
  ['groupCount Q-ACTIVE by level', () => questions.groupCount('Q-ACTIVE', 'educationLevelId')],
  ['count Q-DIFFICULTY', () => questions.count('Q-DIFFICULTY', 2)],
  [
    'M05 practiceQuery (10 of MATH D1)',
    () =>
      questions.practiceQuery({ subjectId: 3, educationLevelIds: [1], limit: 10, seed: 'perf' }),
  ],
  [
    'M05 chapter draw',
    () =>
      questions.practiceQuery({ subjectId: 3, curriculumChapterId: 1, limit: 10, seed: 'chapter' }),
  ],
  ['M06 spmPool total', () => questions.spmPool({ subjectId: 4 }).total],
  ['M06 spmPool sample 40', () => questions.spmPool({ subjectId: 5 }).sample(40, mulberry32(1))],
  ['M06 spmPool page 10', () => questions.spmPool({ subjectId: 5 }).page(10)],
  ['M08 spAvailable', () => questions.spAvailable(194)],
  ['M10 contributions page 1', () => questions.contributions(1)],
  ['M10 contributions page 500', () => questions.contributions(1, { page: 500 })],
  ['M10 databank page 1', () => questions.teacherDatabank(1)],
  [
    'M10 databank search',
    () => questions.teacherDatabank(1, { q: 'peribahasa', difficulty: 3 }),
    'native',
  ],
  [
    'M11 chapterLabel count',
    () => questions.countWhere({ chapterLabel: 'Sejarah Tingkatan 5 KSSM' }),
  ],
  [
    'M16 sampleKeyless',
    () =>
      questions.sampleKeyless(
        { subjectId: 1, educationLevelIds: [1], questionType: 'mcq', eligible: true },
        30,
        mulberry32(3),
      ),
  ],
  [
    'M16 jutawanSample',
    () => questions.jutawanSample({ subjectId: 5, level: 7 }, 15, mulberry32(2)),
  ],
  ['M17 Q-M17-COV by subject', () => questions.groupCount('Q-M17-COV', 'subjectId')],
  ['M17 teacherContributions', () => questions.teacherContributions()],
  ['M07 PKSK list page 39', () => questions.pkskList({ page: 39 })],
  ['M07 PKSK search', () => questions.pkskList({ search: 'inovasi' }), 'native'],
  // Structured (S8, M05 S10, M06 S7–S9, M10 S17) and reports (S7, S13).
  ['S8 structured page 1', () => structured.adminList({})],
  ['S8 structured filter', () => structured.adminList({ subjectId: 2, kbatLevel: 5 })],
  ['M05 structured visible', () => structured.visible({ subjectId: 1 })],
  ['M10 structured list (updatedAt)', () => structured.list({ page: 3 })],
  ['S7 reports', () => reports.list('pending')],
]

describe('M04 query budget (466,041 rows)', () => {
  const results: Record<string, string> = {}

  for (const [label, fn, kind] of cases) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results, kind ?? 'js')
    }, 60_000)
  }

  it('reports timings', () => {
    perf.report(
      `N=${String(questionsDataset.count())} cells=${String(questionsDataset.cells().length)}`,
      results,
    )
  })
})

describe('calibration summary', () => {
  it('logs ratios and skips; fails when too many budget gates were skipped', () => {
    perf.logSummary()
    perf.assertSkipShare()
  })
})
