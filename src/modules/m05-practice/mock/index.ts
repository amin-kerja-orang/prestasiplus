/**
 * M05 mock plugin (F-26: the shared practice store; SRS M05 v1.17 §6, §6.14, §7; overview §6.7,
 * §6.8, D11/D12). Owner of the `practice.sessions` and `practice.answers` virtual datasets and of the
 * practice tables (revision queue, mastery counters, SPM targets, structured attempts, answer
 * checks, subject usage).
 *
 * PUBLIC exports (the only M05 mock code other modules may import, `@/modules/m05-practice/mock`):
 * - `practice` — sessions (named queries Q-SESS-*), the write path (`startSession`, `checkAnswer`,
 *   `completeSession` incl. the BR-34 direct form, `addAnswer`, `addSession`), the reads
 *   (`session`, `history`, `historyPage`, `answers`, `sessionAnswers`, `queue`, `queueAll`,
 *   `mastery`, `chapterStats`, `spmTargets`, `subjectUsage`, `sessionMeanAccuracy`,
 *   `distinctUsers`) and the seed contributions (`contributeAnswers`, `contributeSessions`,
 *   `contributeMastery`);
 * - `practiceAnswers` — the answer log's named queries Q-ANS-*;
 * - `practice.weekRank(options)` — Q-WEEK-RANK for M16 S20 (F-26c);
 * - `kirkpatrick` — the KirkpatrickSessionAggregate (DATA-M05-12, F-26c): the M12 session segment,
 *   a separate D11 set of 20,991 aggregates (`sessions`, `totals`, `students`, `schools`,
 *   `subjects`, `months`, `month`, `heat`, `student`, `schoolIds`, `addSession`; Q-M12-SESSIONS*);
 * - `pupilSubjectAccuracy` — the stored per-pupil × subject accuracy set of M18 (DATA-M05-13,
 *   F-26c): `all`, `forUser`, `forUsers`;
 * - the row types and `PracticeError`.
 *
 * Routes: §7 #4–#6 and #23 (F-26); #1–#3 and #7–#14 (M05-T1, `handlers/`); #15–#21 (M05-T2, `handlers/structured.ts`,
 * `targets.ts`, `assigned.ts`); #22 is M04's `POST /api/question-reports`. Hooks (M05-T1, `hooks/`): `addSession`, `addAnswer`,
 * `setSubjectiveCounts`, `setSpmProgress`, `answerChapter`. API types and client functions: `../api`.
 *
 * Bump `version` whenever the seed, a spec, `derive` or a cheap field changes (overview §6.9,
 * §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { answersDataset } from './datasets/answers'
import { kirkpatrickDataset } from './datasets/kirkpatrick'
import { sessionsDataset } from './datasets/sessions'
import { assignedRoutes, remedialPreviewRoutes } from './handlers/assigned'
import { chapterRoutes } from './handlers/chapters'
import { dashboardRoutes } from './handlers/dashboard'
import { learnerRoutes } from './handlers/learner'
import { revisionRoutes } from './handlers/revision'
import { sessionRoutes } from './handlers/sessions'
import { structuredRoutes } from './handlers/structured'
import { subjectRoutes } from './handlers/subjects'
import { targetRoutes } from './handlers/targets'
import { FIXTURE_TABLES, m05Hooks } from './hooks'
import { kirkpatrickRepo } from './repository/kirkpatrick'
import { practiceAnswersRepo, practiceRepo } from './repository/practice'
import { pupilAccuracyRepo } from './repository/pupil-accuracy'
import { finalisePractice, seedPractice } from './seeds/defaults'
import { pupilAccuracyTable } from './tables/pupil-accuracy'
import { M05_TABLES } from './tables/tables'

// The canonical anchors and the other modules' contributions are completed and added when the
// datasets compile (M01 and M04 have compiled by then; `repository/anchors.ts`).
for (const ds of [answersDataset, sessionsDataset]) {
  const compile = ds.compile.bind(ds)
  ;(ds as { compile: () => void }).compile = () => {
    if (!ds.compiled) practiceRepo.prepareAnchors()
    compile()
  }
}

const plugin = defineMockModule({
  id: 'M05',
  // M09 (banners, articles) and M14 (wallet, streak, quests, badges) are read at request time only
  // (`handlers/dashboard.ts`, `repository/seams.ts`), never while seeding, so they are not
  // dependencies: the F-26 tests boot M05 without M14, and M14 in turn reads M05 (a cycle).
  dependsOn: ['core', 'M01', 'M02', 'M03', 'M04'],
  version: 7,
  tables: { ...M05_TABLES, pupilSubjectAccuracy: pupilAccuracyTable, ...FIXTURE_TABLES },
  datasets: {
    practiceAnswers: answersDataset,
    practiceSessions: sessionsDataset,
    kirkpatrickSessions: kirkpatrickDataset,
  },
  repositories: {
    practice: practiceRepo,
    practiceAnswers: practiceAnswersRepo,
    kirkpatrick: kirkpatrickRepo,
    pupilSubjectAccuracy: pupilAccuracyRepo,
  },
  seed: seedPractice,
  finalise: finalisePractice,
  routes: [
    ...sessionRoutes,
    ...dashboardRoutes,
    ...subjectRoutes,
    ...chapterRoutes,
    ...revisionRoutes,
    ...learnerRoutes,
    // M05-T2: #15–#17 structured, #18–#19 SPM targets, #20–#21 remedial tests and missions.
    ...structuredRoutes,
    ...targetRoutes,
    ...assignedRoutes,
    ...remedialPreviewRoutes,
  ],
  hooks: m05Hooks,
})

export default plugin

export const { practice, practiceAnswers, kirkpatrick, pupilSubjectAccuracy } = plugin.repositories

export type {
  AnswerRow,
  CheckRow,
  MasteryRow,
  PracticeMode,
  QueueRow,
  SessionRow,
  SessionStatus,
  SpmGrade,
  SpmTargetRow,
  StructuredAttemptRow,
} from './datasets/types'
export type { AnswerAnchorInput, SessionAnchorInput } from './repository/anchors'
export type {
  CheckResult,
  CompleteResult,
  DirectCompletion,
  StartResult,
  SubmitCompletion,
} from './repository/practice'
export type {
  AnswerFilter,
  ChapterStats,
  HistoryFilter,
  MasteryItem,
  QueueItem,
  SessionSummary,
} from './repository/reads'
export type { StartRequest } from './repository/start'
export type {
  KaMonthAgg,
  KaScope,
  KaSchoolAgg,
  KaSessionInput,
  KaSessionRow,
  KaStudentAgg,
  KaStudentDetail,
  KaSubjectAgg,
  KaTotals,
} from './repository/kirkpatrick'
export type { PupilAccuracyInput, PupilAccuracyRow } from './repository/pupil-accuracy'
export type { WeekRankOptions, WeekRankRow } from './repository/week-rank'
export type { HeatGrid } from './datasets/kirkpatrick-heat'
export { PracticeError, PRACTICE_MODES, SPM_MODES } from './repository/rules'
