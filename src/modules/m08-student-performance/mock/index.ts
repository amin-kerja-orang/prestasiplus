/**
 * M08 mock plugin (M08-T1: the student-performance read models; SRS M08 v1.11 §6, §7; overview §6.7,
 * D11/D12). Owner of the SpRecord, RiskProfile, TimelinePost, RankingEntry, LeaderboardStanding,
 * SchoolSpmHistory, ItemStatistic and LearnerActivityStats stores (M08-T1) and, since M08-T1b, of
 * HeadcountConfig and HeadcountEntry.
 *
 * PUBLIC exports (the only M08 mock code other modules may import, `@/modules/m08-student-performance/mock`):
 * `schoolSpmHistory` (M12, M17; incl. `subjectTrend()`, the read-only platform per-subject GPS series 2022–2026), `itemStatistics` (M18), and the read repositories `spRecords`,
 * `timeline`, `rankings`, `standings`, `activity`; plus the headcount reader registration
 * `registerHeadcountReads` (for M08-T1b); `classDashboard`, `classItemAnalysis`, `schoolPerformance`
 * (test-facing: the M05 class-228 and teacher-card tests).
 *
 * Routes: §7 #1–#4, #6, #7, #9–#11, #18–#23 and the headcount routes #12–#17, #24–#29 (M08-T1b)
 * (`handlers/`); hooks §6.11 (`hooks/`). HeadcountConfig / HeadcountEntry (M08-T1b) are owned here:
 * `headcount` (`get(configId)` for M17, `entries({...})` for M18, `entriesForStudent`) and the function
 * `headcountEntries(studentId, year)` for M12.
 * Bump `version` whenever the seed, a spec or a cheap field changes (overview §6.9, §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { m08Routes } from './handlers'
import { m08Hooks } from './hooks'
import {
  activityRepo,
  itemStatisticsRepo,
  rankingsRepo,
  schoolSpmHistoryRepo,
  spRecordsRepo,
  standingsRepo,
  timelineRepo,
} from './repository/stores'
import { headcountRepo } from './repository/headcount'
import { finaliseHeadcount } from './seeds/headcount'
import { finaliseM08, seedM08 } from './seeds/m08-t1'
import { HEADCOUNT_TABLES } from './tables/headcount'
import { M08_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M08',
  // M10 (classes) and M14 (wallet, streak, badges) come later in the registry, so they are not listed:
  // M08 reads them at request time only (overview §6.7 call-time reads), never while seeding, except in
  // `finalise`, where every plugin's seed has already run.
  dependsOn: ['core', 'M01', 'M02', 'M03', 'M04', 'M05'],
  version: 3,
  tables: { ...M08_TABLES, ...HEADCOUNT_TABLES },
  repositories: {
    schoolSpmHistory: schoolSpmHistoryRepo,
    itemStatistics: itemStatisticsRepo,
    spRecords: spRecordsRepo,
    timeline: timelineRepo,
    rankings: rankingsRepo,
    standings: standingsRepo,
    activity: activityRepo,
    headcount: headcountRepo,
  },
  seed: seedM08,
  // M08-T1b: the headcount rows and the reader of the headcount port are (re)built on every boot / reset.
  finalise: () => {
    finaliseM08()
    finaliseHeadcount()
  },
  routes: m08Routes,
  hooks: m08Hooks,
})

export default plugin

export const {
  schoolSpmHistory,
  itemStatistics,
  spRecords,
  timeline,
  rankings,
  standings,
  activity,
  headcount,
} = plugin.repositories

/** M12 BR-M12-30: the pupil's headcount entries of an academic year (dropped entries excluded). */
export const headcountEntries = (studentId: number, year: number) =>
  headcount.entriesForStudent(studentId, year)

export { registerHeadcountReads, resetHeadcountReads } from './repository/headcount-port'
/** The S5 class dashboard (M08 BR-M08-10); read by the M05 batch-3 class-228 test. */
export { classDashboard } from './repository/class-performance'
export { classItemAnalysis } from './repository/item-analysis'
export { schoolPerformance } from './repository/performance'
export type { HeadcountEntryView, HeadcountReads } from './repository/headcount-port'
export type * from './repository/types'
export type { SubjectTrend } from './repository/stores'
export type {
  HeadcountConfigDetail,
  HeadcountConfigInput,
  HeadcountEntryDetail,
  HeadcountScopeFilter,
  HeadcountScopedEntry,
} from './repository/headcount'
export type {
  HeadcountConfigRow,
  HeadcountEntryRow,
  HeadcountMode,
} from './repository/headcount-types'
export type { CriticalQuestion } from './data/item-statistics'
