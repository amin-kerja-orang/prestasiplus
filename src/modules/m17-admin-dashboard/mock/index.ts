import { defineMockModule } from '@/mock/define'

import { m17Routes } from './handlers'
import { moodCheckinsRepo } from './repository/provisional-mood'
import { sponsorsRepo } from './repository/provisional-sponsors'
import { tuitionCentresRepo } from './repository/provisional-tuition'
import { finaliseM17Provisional, seedM17Provisional } from './seeds/provisional-seed'
import { M17_PROVISIONAL_TABLES } from './tables/provisional-tables'

/**
 * M17 mock plugin (F-31 stub, build-plan §2.9). F-33 registers the three PROVISIONAL stores M17
 * hosts (overview §6.7.2, XL3-23): `moodCheckins` and `tuitionCentres` (true owner **M26**) and
 * `sponsors` (true owner **M21**). M17's own tasks (M17-T1…) fill in the rest of the plugin.
 *
 * PUBLIC exports (other modules import them from `@/modules/m17-admin-dashboard/mock` only, D12):
 * `moodCheckins`, `tuitionCentres`, `sponsors` and their row types. When M21 or M26 is built, its
 * task moves the definition to its own folder unchanged and M17 stops registering the store.
 *
 * Routes (`handlers/`): SRS §7 #6–#13, the Command Center drill-down (M17-T1a, `command-center-drill*`).
 * The rest of §7 and the plugin's own store belong to M17-T1. Client functions and types: `../api/command-center`.
 *
 * Reads at request time only: M01–M05, M08, M10 and M14 are not `dependsOn` (the F-33 stores boot with M01 and
 * M02 alone); a runtime that serves the §7 routes loads them all, as the registry does.
 *
 * Bump `version` whenever a provisional seed or table changes (overview §6.9).
 */
const plugin = defineMockModule({
  id: 'M17',
  dependsOn: ['core', 'M01'],
  version: 1,
  tables: M17_PROVISIONAL_TABLES,
  repositories: {
    moodCheckins: moodCheckinsRepo,
    tuitionCentres: tuitionCentresRepo,
    sponsors: sponsorsRepo,
  },
  seed: seedM17Provisional,
  finalise: finaliseM17Provisional,
  routes: m17Routes,
})

export default plugin

export const { moodCheckins, tuitionCentres, sponsors } = plugin.repositories

export type {
  DateWindow,
  Mood,
  MoodCheckinRow,
  SponsorRow,
  SponsorStatus,
  SponsorStatusCounts,
  TuitionCentreRow,
} from './repository/provisional-types'
