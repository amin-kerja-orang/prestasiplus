/**
 * M07 mock plugin (M07-T1a: the PKSK student side; SRS M07 v1.7 §6, §7; overview §6.7, D11/D12).
 * Owner of `pkskDomains`, `pkskAccess` and `pkskProgress` (exam attempts, mastery, practice loads);
 * host of the PROVISIONAL `pkskPackages` (true owner M19, `owner: 'M19'`).
 *
 * The 763 PKSK questions are M04 rows: this module contributes them as anchors (ids 177698-178460)
 * and never keeps its own copy; PKSK practice is an M05 session with mode `pksk` written through
 * `practice.completeSession` (BR-M07-26), so there is no M07 session table.
 *
 * PUBLIC exports (other modules import from `@/modules/m07-pksk/mock` only, D12): `pkskDomains`,
 * `pkskAccess`, `pkskProgress`, `pkskPackages` and the row types.
 *
 * Routes (`handlers/`): SRS §7 #1-#6 and #21-#23. #7-#18 (admin) are M07-T1b. Hook `seedPkskAccessEdgeCases`.
 * M05 and M14 are read at request time only (not `dependsOn`, as M08/M17); a runtime that serves the
 * routes loads them all, as the registry does.
 *
 * Bump `version` whenever the seed or a spec changes (overview §6.9, §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { m07Routes } from './handlers'
import { m07Hooks } from './hooks'
import {
  pkskAccessRepo,
  pkskDomainsRepo,
  pkskPackagesRepo,
  pkskProgressRepo,
} from './repository/stores'
import { seedPksk } from './seeds/seed'
import { M07_PROVISIONAL_TABLES, M07_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M07',
  dependsOn: ['core', 'M01', 'M02', 'M04'],
  version: 1,
  tables: { ...M07_TABLES, ...M07_PROVISIONAL_TABLES },
  repositories: {
    pkskDomains: pkskDomainsRepo,
    pkskAccess: pkskAccessRepo,
    pkskProgress: pkskProgressRepo,
    pkskPackages: pkskPackagesRepo,
  },
  seed: seedPksk,
  routes: m07Routes,
  hooks: m07Hooks,
})

export default plugin

export const { pkskDomains, pkskAccess, pkskProgress, pkskPackages } = plugin.repositories

export type {
  Bahagian,
  Grade,
  PackageLevel,
  PkskAccessRow,
  PkskDomain,
  PkskExamAttemptRow,
  PkskLevel,
  PkskMasteryRow,
  PkskPackage,
} from './repository/types'
