/**
 * F-30 query budget (overview §6.6 v1.5; SRS M10 NFR): every read a teacher, school or student
 * screen makes on the M10 stores (750 classes, ~9,000 enrolments, DSKP, the M05 seams) runs in
 * ≤ 50 ms, and the one-off class build in `finalise` stays inside the boot budget (§6.14).
 *
 * Timing uses F-09's paired-calibration harness: each case is paired with a floor pass, the ratio
 * gate (`best ≤ cap × floor`) is always enforced, and the ms budget scales with the floor up to
 * 1.5× (beyond that the budget gate is skipped explicitly; `assertSkipShare` fails the run when too
 * many are skipped).
 */

import { beforeAll, describe, it } from 'vitest'

import { createPerfCalibration, type PerfCap } from '@/mock/dataset/testing/perf-calibration'

import { classrooms, dskp, missions, questionSets, remedialTests } from '../../mock'
import { buildClasses } from '../../mock/build/classes'
import { loadPeople } from '../../mock/build/people'
import { bootM10 } from './helpers'

const BUDGET_MS = 50
/** The class build runs once per boot: people snapshot + 750 classes + enrolments (§6.14). */
const BUILD_BUDGET_MS = 400

/**
 * Ratio caps (`best / paired floor`), from 3 runs with `suggestCaps` (the machine was shared with
 * other agents while calibrating: re-run `npm run test:perf` on a quiet machine before G4).
 */
const RATIO_CAPS: Readonly<Record<string, PerfCap>> = {
  'S4 forTeacher (1919, 7 classes)': { cap: 0.00013, noisy: true, slackMs: 1 }, // min 0.00006, median 0.00008, max 0.00010, 3 runs
  'S4 forTeacher (busy owner)': { cap: 0.000048, noisy: true, slackMs: 1 }, // min 0.00003, median 0.00003, max 0.00004, 3 runs
  'S10 forSchool (8102)': { cap: 0.0079, noisy: true, slackMs: 1 }, // min 0.00291, median 0.00526, max 0.00616, 3 runs
  'S33 forStudent (3001)': { cap: 0.000061, noisy: true, slackMs: 1 }, // min 0.00003, median 0.00004, max 0.00005, 3 runs
  'S5 members (228, 93)': { cap: 0.0018, noisy: true, slackMs: 1 }, // min 0.00098, median 0.00119, max 0.00123, 3 runs
  'S6 teacherStudentIds (1919)': { cap: 0.002, noisy: true, slackMs: 1 }, // min 0.00101, median 0.00117, max 0.00161, 3 runs
  'S33 findByJoinCode': { cap: 0.0069, noisy: true, slackMs: 1 }, // min 0.00451, median 0.00454, max 0.00470, 3 runs
  'M08 levelSummary T5': 0.1, // min 0.05855, median 0.06212, max 0.08316, 3 runs
  'M08 levelSummary T4': { cap: 0.0064, noisy: true, slackMs: 1 }, // min 0.00422, median 0.00424, max 0.00465, 3 runs
  'M08 list T5': { cap: 0.0042, noisy: true, slackMs: 1 }, // min 0.00252, median 0.00280, max 0.00308, 3 runs
  'M08 owners': { cap: 0.0037, noisy: true, slackMs: 1 }, // min 0.00188, median 0.00243, max 0.00303, 3 runs
  'M05 missions.forStudent': { cap: 0.000034, noisy: true, slackMs: 1 }, // min 0.00002, median 0.00002, max 0.00003, 3 runs
  'M05 missions.questionIdsFor': 0.13, // min 0.08097, median 0.08447, max 0.09139, 3 runs
  'M05 remedialTests.forStudent': { cap: 0.000018, noisy: true, slackMs: 1 }, // min 0.00001, median 0.00001, max 0.00001, 3 runs
  'M05 questionSets.visibleFor': { cap: 0.000087, noisy: true, slackMs: 1 }, // min 0.00006, median 0.00006, max 0.00007, 3 runs
  'S18 dskp.bidang': { cap: 0.00019, noisy: true, slackMs: 1 }, // min 0.00010, median 0.00012, max 0.00012, 3 runs
  'S7 dskp.spPath': { cap: 0.0000037, noisy: true, slackMs: 1 }, // min 0.00000, median 0.00000, max 0.00000, 3 runs
  'class build': { cap: 3.6, noisy: true, slackMs: 150 }, // single shot, GC-bound; min 2.15400, median 2.35200, max 2.78300, 3 runs
}

const perf = createPerfCalibration({ prefix: 'M10 perf', caps: RATIO_CAPS })

beforeAll(async () => {
  await bootM10()
  perf.setup()
}, 120_000)

const CASES: readonly (readonly [string, () => unknown])[] = [
  ['S4 forTeacher (1919, 7 classes)', () => classrooms.forTeacher(1919)],
  [
    'S4 forTeacher (busy owner)',
    () => classrooms.forTeacher(classrooms.designation().owners[40] as number),
  ],
  ['S10 forSchool (8102)', () => classrooms.forSchool(8102)],
  ['S33 forStudent (3001)', () => classrooms.forStudent(3001)],
  ['S5 members (228, 93)', () => classrooms.members('classroom', 228)],
  ['S6 teacherStudentIds (1919)', () => classrooms.teacherStudentIds(1919)],
  ['S33 findByJoinCode', () => classrooms.findByJoinCode('DEMO-4S')],
  ['M08 levelSummary T5', () => classrooms.levelSummary('tingkatan-5')],
  ['M08 levelSummary T4', () => classrooms.levelSummary('tingkatan-4')],
  ['M08 list T5', () => classrooms.list({ educationLevel: 'tingkatan-5' })],
  ['M08 owners', () => classrooms.owners()],
  ['M05 missions.forStudent', () => missions.forStudent(3001, '2026-09-22')],
  ['M05 missions.questionIdsFor', () => missions.questionIdsFor(7101, 3001)],
  ['M05 remedialTests.forStudent', () => remedialTests.forStudent(3008)],
  ['M05 questionSets.visibleFor', () => questionSets.visibleFor(3001)],
  ['S18 dskp.bidang', () => dskp.bidang({ subjectId: 1, educationLevelId: 10 })],
  ['S7 dskp.spPath', () => dskp.spPath(9001)],
]

describe('M10 query budget', () => {
  const results: Record<string, string> = {}
  for (const [label, fn] of CASES) {
    it(`${label} ≤ ${String(BUDGET_MS)} ms (paired)`, (ctx) => {
      perf.timedCase(ctx, label, fn, BUDGET_MS, results)
    })
  }
  it(`class build (people + 750 classes + enrolments) ≤ ${String(BUILD_BUDGET_MS)} ms (paired, single shot)`, (ctx) => {
    const { value, floor } = perf.paired(() => {
      const t0 = performance.now()
      buildClasses(loadPeople())
      return performance.now() - t0
    })
    perf.gate(ctx, 'class build', value, floor, BUILD_BUDGET_MS, results)
  })
  it('reports timings', () => perf.report('M10 perf', results))
})

describe('regression proof (F09-5)', () => {
  it('the ratio gate catches a 2× slower mission draw (the heaviest read)', (ctx) => {
    perf.proveRegression(ctx, 'M05 missions.questionIdsFor', () =>
      missions.questionIdsFor(7101, 3001),
    )
  })
})

describe('calibration summary', () => {
  it('logs ratios and skips; fails when too loaded', () => {
    perf.logSummary()
    perf.assertSkipShare()
  })
})
