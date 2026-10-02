/**
 * M11 mock plugin (M11-T1: teacher analytics and reports; SRS M11 v1.10 §6, §7; overview §6.7, D11/D12).
 * Owner of one stored entity only, DATA-M11-01 MonitoringFlag (and the DATA-M11-02 constants); every
 * figure on S1–S6 is computed per request from the owners' datasets (M01 users, M02 schools and
 * subscriptions, M03 curriculum, M04 questions, M05 answer log and sessions, M10 classes).
 *
 * PUBLIC exports (the only M11 mock code other modules may import, `@/modules/m11-teacher-analytics/mock`):
 * - `monitoring` — `overview`, `schoolDetail`, `studentDetail`, `teacherDetail`, `exportRows` (S2–S5 and
 *   the export; M17 mounts the same functions on `/admin/monitoring*`), `teacherReport` and
 *   `itemAnalysis` (S1, S6), the flag reads and `settings`;
 * - `registerM16Reads` / `resetM16Reads` — the M16 reader port (battles and game results, SRS M11 §6.1);
 *   M16 registers it from its seed, until then M11 reads 0;
 * - the row types.
 *
 * Routes: §7 #1, #3–#8 (`handlers/`); #2 is M10 #12 and #9 is M03 #28. Seed: the S4 anchors contributed
 * to M04 and M05 (`seeds/anchors.ts`) and the flags (`seeds/seed.ts`, finalise). Client functions and
 * types: `../api`. Test hooks (§6.9) belong to the UI tasks.
 *
 * Bump `version` whenever the seed, an anchor or a rule that changes a figure changes (overview §6.9,
 * §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { m11Routes } from './handlers'
import { monitoringRepo } from './repository'
import { finaliseM11, seedM11 } from './seeds/seed'
import { M11_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M11',
  // M08 (designed sessions of the teacher's pupils) and M16 (battles) are data and port only.
  dependsOn: ['core', 'M01', 'M02', 'M03', 'M04', 'M05', 'M10'],
  version: 1,
  tables: M11_TABLES,
  repositories: { monitoring: monitoringRepo },
  seed: seedM11,
  finalise: finaliseM11,
  routes: m11Routes,
})

export default plugin

export const { monitoring } = plugin.repositories

export { registerM16Reads, resetM16Reads } from './repository/ports'
export type { BattleCounts, GameCounts, M16Reads, TimeRange } from './repository/ports'
export type { MonitoringFilters, MonitoringScope, Viewer } from './repository'
export type { MonitoringFlagRow } from './tables/tables'
