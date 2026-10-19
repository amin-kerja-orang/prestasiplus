import { defineMockModule } from '@/mock/define'

import { m18Routes } from './handlers'
import { amaranInterventionsRepo, correctionSubjectsRepo } from './repository/stores'
import { finaliseM18 } from './seeds/seed'
import { M18_TABLES } from './tables/tables'

/**
 * M18 mock plugin (SRS M18 v1.8 §6, §7; overview §6.7, D11/D12). Owner of the AmaranIntervention
 * (DATA-M18-01) and CorrectionSubject (DATA-M18-04) stores.
 *
 * PUBLIC exports (the only M18 mock code other modules may import, `@/modules/m18-ppd-jpn/mock`):
 * - `risk` — the Amaran Awal read model (BR-M18-13/14): `forSchool(schoolId, {tingkatan?, now?})`
 *   -> `{total, onTrack, watch, high}` (M27 S0 "AMARAN AWAL" = Selamat / Berhati / Berisiko; M27 S4),
 *   `forClass`, `forScope`, `pupilsForSchool` / `pupilsForClass` / `pupilsForScope` and the pure
 *   `compute`. Pass `now: ctx.clock.now()` from a handler (the default is the app clock);
 * - `amaran` — what endpoints #21, #22, #24, #30 return, with a schoolId parameter: `schoolRisk`,
 *   `subjectRisk`, `atRiskList`, `summary`, `effectiveness`, `schoolCsv`;
 * - the row / view types.
 *
 * Routes: §7 #21, #22, #24, #30 (`handlers/amaran.ts`). Reads the owners at request time only (M01,
 * M02, M03, M05, M10, M14); seeds in `finalise`.
 * Bump `version` whenever a seed or a table changes (overview §6.9).
 */
const plugin = defineMockModule({
  id: 'M18',
  dependsOn: ['core', 'M01', 'M02', 'M03', 'M05'],
  version: 1,
  tables: M18_TABLES,
  repositories: {
    amaranInterventions: amaranInterventionsRepo,
    correctionSubjects: correctionSubjectsRepo,
  },
  finalise: finaliseM18,
  routes: m18Routes,
})

export default plugin

export const { amaranInterventions, correctionSubjects } = plugin.repositories

export { risk, masteryLevelOf, computeRisk, statusOf, resetRiskCache } from './repository/risk'
export type { RiskRepository, RiskComputed, RiskInputs } from './repository/risk'
export {
  amaran,
  atRiskList,
  csvCell,
  effectivenessForSchool,
  schoolCsv,
  schoolRisk,
  subjectRisk,
  summary,
  tallyView,
  STATUS_LABEL,
  TYPE_LABEL,
} from './repository/amaran'
export type {
  EffectivenessReport,
  KomboSummary,
  SchoolRiskData,
  SchoolRow,
  SummaryData,
} from './repository/amaran'
export { amaranExportAudit, resetAmaranExportAudit } from './handlers'
export { m18SeedIssues } from './seeds/seed'
export type * from './repository/types'
