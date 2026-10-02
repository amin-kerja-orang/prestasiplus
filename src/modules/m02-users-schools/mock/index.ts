/**
 * M02 mock plugin (F-23: the shared schools store and the JPN / PPD lookups; overview §6.10,
 * D11/D12). Owner of `schools` (virtual dataset, SRS v1.18 §6.15 A), `schools.jpn` and
 * `schools.ppd`. The users store belongs to M01 (base) with M02's admin extension fields; M02
 * reads and administers it through `users` from `@/modules/m01-authentication/mock`.
 *
 * PUBLIC exports (`@/modules/m02-users-schools/mock`): the `schools` repository and its row types.
 *
 * Seed: the JPN / PPD lookups and the hashed secrets of the M02 fixture users 5001–5990 (demo
 * password; the fictitious complimentary ICs, through the M01 `users` repository). `finalise` runs the schools build
 * check (the named figures of §6.15 A, the M18 register pins) and checks that every user's school exists; a failure
 * stops the boot.
 *
 * Routes (F-23): the public lookups #38 `GET /api/schools/search`, #40 `GET /api/jpn`, #41
 * `GET /api/jpn/:id/ppd`. M02-T1…T3 add the admin handlers.
 *
 * Bump `version` whenever the seed, the spec, `derive` or a cheap field changes (overview §6.9).
 */

import { DEMO_PASSWORD } from '@/mock/core-data/accounts'
import { checkNamedQueries } from '@/mock/dataset'
import { defineMockModule } from '@/mock/define'
import { complimentaryIc, users, type FixtureSecret } from '@/modules/m01-authentication/mock'

import { SCHOOLS_REGISTER_TEXT } from './datasets/schools-anchors'
import { schoolsDataset } from './datasets/schools'
// M02-T2 (schools admin, imports, quota): routes #12–#15, #24–#28, #43.
import { importRoutes } from './handlers/imports'
import { schoolAdminRoutes } from './handlers/schools-admin'
import { schoolPublicRoutes } from './handlers/schools-public'
// M02-T1 (admin users): routes #1–#11, #39 and the config defaults, the parent links and S16 package tables.
import { adminConfigRoutes } from './handlers/admin-config'
import { parentInviteRoutes } from './handlers/parent-invites'
import { parentInvitesRepo, parentInvitesTable } from './handlers/parent-invites-store'
import { parentLinksRepo, parentLinksTable } from './handlers/parent-links-store'
import { m02Hooks } from './hooks'
import {
  schoolAdminPackagesRepo,
  schoolAdminPackagesTable,
} from './handlers/school-admin-packages-store'
import { userAdminRoutes } from './handlers/users-admin'
import { userPackageRoutes } from './handlers/users-packages'
import { checkUsersAdmin, seedUsersAdmin } from './seeds/users-admin'
// M02-T3 (complimentary students, subscriptions, packages, invoice): routes #16–#23, #29–#37, #42.
import { compStudentRoutes } from './handlers/comp-students'
import { subscriptionRoutes } from './handlers/subscriptions'
import {
  complimentaryProfilesTable,
  complimentaryRepo,
  setCompWalletSource,
} from './repository/complimentary'
import { setSubscriptionSource } from './quota'
import {
  schoolPackagesRepo,
  schoolPackagesTable,
  schoolSubscriptionsRepo,
  schoolSubscriptionsTable,
} from './repository/subscriptions'
import { checkBilling, M02_OVERRIDES, seedBilling } from './seeds/billing'
import {
  fixtureSchoolsTable,
  jpnTable,
  ppdTable,
  schoolQueries,
  schoolsRepo,
} from './repository/schools'

/** The M02 fixture users (§6.14): they get the demo password; complimentary ones their fictitious IC. */
const FIXTURE_USER_RANGES: readonly (readonly [number, number])[] = [
  [5001, 5210],
  [5301, 5329],
  [5401, 5411],
  [5501, 5502],
  [5601, 5605],
  [5701, 5703],
  [5711, 5711],
  [5801, 5801],
  [5901, 5990],
]

function fixtureSecrets(): FixtureSecret[] {
  const out: FixtureSecret[] = []
  for (const [from, to] of FIXTURE_USER_RANGES) {
    for (let id = from; id <= to; id++) {
      out.push({ id, password: DEMO_PASSWORD, icNumber: complimentaryIc(id) })
    }
  }
  return out
}

const plugin = defineMockModule({
  id: 'M02',
  dependsOn: ['core', 'M01'],
  version: 6,
  overrides: M02_OVERRIDES,
  tables: {
    jpn: jpnTable,
    ppd: ppdTable,
    fixtureSchools: fixtureSchoolsTable,
    parentLinks: parentLinksTable,
    parentInvites: parentInvitesTable,
    schoolAdminPackages: schoolAdminPackagesTable,
    schoolPackages: schoolPackagesTable,
    schoolSubscriptions: schoolSubscriptionsTable,
    complimentaryProfiles: complimentaryProfilesTable,
  },
  datasets: { schools: schoolsDataset },
  repositories: {
    schools: schoolsRepo,
    parentLinks: parentLinksRepo,
    parentInvites: parentInvitesRepo,
    schoolAdminPackages: schoolAdminPackagesRepo,
    schoolPackages: schoolPackagesRepo,
    schoolSubscriptions: schoolSubscriptionsRepo,
    complimentary: complimentaryRepo,
  },
  fixtures: { schoolsRegister: SCHOOLS_REGISTER_TEXT },
  seed(ctx) {
    schoolsRepo.seedLookups()
    users.seedFixtureSecrets(fixtureSecrets())
    seedUsersAdmin(ctx)
    seedBilling(ctx.overrides)
    // The module-level wallet seam is cleared on every boot / reset, so a test registration cannot leak.
    setCompWalletSource(null)
    // XR-M02-T2-01: the T2 quota rules (S5 import, #14) read the subscriptions through this seam.
    setSubscriptionSource((schoolId) => schoolSubscriptionsRepo.quotaRows(schoolId))
  },
  finalise(ctx) {
    const issues = [
      ...checkNamedQueries(schoolQueries).map((i) => i.message),
      ...checkUsersAdmin(),
      ...checkBilling(ctx.overrides),
    ]
    for (const id of users.schoolsWithUsers()) {
      if (!schoolsRepo.get(id))
        issues.push(`users reference school ${String(id)}, which does not exist`)
    }
    if (issues.length > 0) {
      throw new Error(`M02 schools build check failed:\n${issues.map((m) => `- ${m}`).join('\n')}`)
    }
  },
  routes: [
    ...schoolPublicRoutes,
    ...schoolAdminRoutes,
    ...importRoutes,
    ...userAdminRoutes,
    ...userPackageRoutes,
    ...adminConfigRoutes,
    ...compStudentRoutes,
    ...subscriptionRoutes,
    // L45 (Jemput Ibu Bapa): #1–#4; the `parentInvites` store (M02) and the shared `parentLinks`.
    ...parentInviteRoutes,
  ],
  hooks: m02Hooks,
})

export default plugin

export const {
  schools,
  parentLinks,
  parentInvites,
  schoolAdminPackages,
  schoolPackages,
  schoolSubscriptions,
} = plugin.repositories

/**
 * The complimentary-student contract other modules read (M14 `Reflect.get(m02, 'complimentary')`,
 * `coinsEnabled` BR-18). A plain object (not the repository) so a loosely typed reader can hold it.
 */
export const complimentary = {
  /** Whether the student may collect syiling / coins: a complimentary student defaults to OFF. */
  coinsEnabled: (userId: number): boolean => plugin.repositories.complimentary.coinsEnabled(userId),
  /** The profile row of a complimentary student. */
  get: (userId: number) => plugin.repositories.complimentary.get(userId),
}
/** M02-T3: the `SchoolPackage` / `SchoolSubscription` rows, the M19 status counts and the M14 seams. */
export type { SchoolPackageRow, SchoolSubscriptionRow } from './repository/subscriptions'
export type { ComplimentaryProfileRow, CompWallet } from './repository/complimentary'
export { setCompWalletSource } from './repository/complimentary'
export type { ParentLinkRow } from './handlers/parent-links-store'
export type { ParentInviteRow } from './handlers/parent-invites-store'
export type { SchoolAdminPackageRow } from './handlers/school-admin-packages-store'

export type { Jpn, Ppd, School, SchoolOption, SchoolSummary, SchoolType } from './repository/types'
export type { SchoolInput, SchoolListFilter, SchoolSearchInput } from './repository/schools'
export { isFixtureSchoolId, FIXTURE_SCHOOL_IDS } from './datasets/schools-anchors'
/** M02-T2: the fixture default passwords (SEC-M02-01…03) and the quota seam for M02-T3. */
export { m02Config, type M02Config } from './m02-config'
export {
  schoolQuota,
  setSubscriptionSource,
  studentsAt,
  type QuotaSubscription,
  type SubscriptionSource,
} from './quota'
export { toTitleCase } from './import/text'
/** M02 BR-12 expiry rule (provisional host of M19 `billing.computeExpiry`, XR-M19-04). */
export { computeExpiry, type Billing, type PackageCode } from './repository/billing'
