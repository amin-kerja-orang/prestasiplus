/**
 * M06 mock plugin (M06-T1: SPM mock handlers; SRS M06 v1.4 §6, §7; overview §6.6, §6.10, D11/D12).
 *
 * Owner of two stored entities: DATA-M06-03 TrackingASet and DATA-M06-05 MockExam. The SPM question pool
 * is the M04 dataset (the §6.10 cells equal M04's default; `poolCells` override contributes via `questions.contributeCells`); SPM quiz
 * sessions and S10 history are M05 endpoints #4-#6 and #23 (no M06 session endpoints).
 *
 * PUBLIC export (the only M06 mock code other modules may import, `@/modules/m06-spm/mock`): the `spm`
 * repository; M05 calls `spm.ramalanQuestions(subjectId, year, setNo)` for `ramalan` starts.
 *
 * Routes: §7 #1-#7, #12-#17 (M06-owned) plus the PROVISIONAL `GET /api/duta/recommendations` (owner M24).
 * Hub figures 20,529 / 14,673 are documented display constants (`./constants/display.ts`, DV-M06-01).
 * Hooks: `setWalkthroughLatency(ms)` (default 1,500); `setRandomSeed`, `setLatency`, `failNext`, `setNow`
 * are the shared built-ins.
 *
 * Bump `version` whenever the seed, a set, a mock or a rule that changes a figure changes.
 */

import { defineMockModule } from '@/mock/define'

import { dutaRoutes } from './handlers/duta'
import { mockRoutes, resetWalkthroughLatency, setWalkthroughLatency } from './handlers/mocks'
import { spmReadRoutes } from './handlers/spm'
import { spmRepo } from './repository/spm'
import { finaliseM06, seedM06 } from './seeds/seed'
import { mockExamsTable, trackingSetsTable } from './tables/tables'

const plugin = defineMockModule({
  id: 'M06',
  dependsOn: ['core', 'M01', 'M02', 'M03', 'M04', 'M05'],
  version: 1,
  tables: { mockExams: mockExamsTable, trackingSets: trackingSetsTable },
  repositories: { spm: spmRepo },
  seed(ctx) {
    resetWalkthroughLatency()
    seedM06(ctx)
  },
  // Sets and mocks read the compiled question dataset, so they are seeded at finalise.
  finalise: finaliseM06,
  routes: [...spmReadRoutes, ...mockRoutes, ...dutaRoutes],
  hooks: { setWalkthroughLatency },
  // `reset({ poolCells })`: optional pool cells to contribute (see `seedM06`).
  overrides: ['poolCells'],
})

export default plugin

export const { spm } = plugin.repositories

export type { SetView } from './repository/spm'
export type { MockExamRow, TrackingSetRow } from './tables/tables'
