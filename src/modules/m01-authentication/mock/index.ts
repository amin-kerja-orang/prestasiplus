/**
 * M01 mock plugin (F-23: the shared users store; overview §6.10, D11/D12). Owner of `users` (the
 * users virtual dataset, M02 SRS v1.18 §6.15 B–D, with the M02 admin extension fields) and
 * `users.secrets` (salted hashes only).
 *
 * PUBLIC exports (the only M01 mock code other modules may import, `@/modules/m01-authentication/mock`):
 * the `users` repository and its row types. The mock core (`src/mock/core-data`) seeds the
 * canonical accounts' secrets through `users.seedCanonical()` (overview §6.9 phase 1); their rows
 * are literal anchors of the dataset.
 *
 * `finalise` runs the §6.15 build check (every documented total, the M11 per-school register, the
 * M17 pins, 61 / 57 schools) and compiles the named selections; a failure stops the boot.
 *
 * Bump `version` whenever the seed, the spec, `derive` or a cheap field changes (overview §6.9,
 * §14 rule 4b). M01-T1 adds the auth handlers.
 */

import { defineMockModule } from '@/mock/define'

import { usersDataset } from './datasets/users'
import { userSecretsTable, usersRepo } from './repository/users'
import { checkUsersDataset } from './repository/users-check'
// M01-T2 (notifications): table + repository, routes #13–#19, seeds and the `pushNotification` hook.
import { notificationRoutes } from './handlers/notifications'
import { notificationsRepo, notificationsTable } from './handlers/notifications-store'
import { pushNotification } from './hooks/notifications'
import { seedNotifications } from './seeds/notifications'
// M01-T1 (auth): tables + repositories, routes #1–#6, #8–#12, #21, seed and the `expireSession` hook.
import { accountRoutes } from './handlers/auth-account'
import { authRoutes } from './handlers/auth'
import {
  loginThrottleRepo,
  loginThrottleTable,
  passwordResetsRepo,
  passwordResetsTable,
  userSettingsRepo,
  userSettingsTable,
} from './handlers/auth-state'
import { statsRoutes } from './handlers/auth-stats'
import { expireSession } from './hooks/expire-session'
import { seedAuth } from './seeds/auth'
// M27-T0b (XR-M27-21): the school-admin impersonation switch with return path and audit.
import { impersonation, impersonationAudit } from './impersonation'

const plugin = defineMockModule({
  id: 'M01',
  dependsOn: ['core'],
  version: 7,
  tables: {
    userSecrets: userSecretsTable,
    notifications: notificationsTable,
    passwordResets: passwordResetsTable,
    loginThrottle: loginThrottleTable,
    userSettings: userSettingsTable,
  },
  datasets: { users: usersDataset },
  repositories: {
    users: usersRepo,
    notifications: notificationsRepo,
    passwordResets: passwordResetsRepo,
    loginThrottle: loginThrottleRepo,
    userSettings: userSettingsRepo,
  },
  routes: [...authRoutes, ...accountRoutes, ...statsRoutes, ...notificationRoutes],
  hooks: { pushNotification, expireSession, impersonationAudit },
  seed(ctx) {
    impersonation.resetAudit()
    usersRepo.resetSelections()
    seedNotifications()
    seedAuth(ctx)
  },
  finalise() {
    // v1.23: the seeded M18 activity dates first (the build check counts them).
    const activity = usersRepo.compileActivity()
    const issues = [...activity, ...checkUsersDataset().map((i) => i.message)]
    if (issues.length > 0) {
      throw new Error(
        `M01 users dataset build check failed:\n${issues.map((m) => `- ${m}`).join('\n')}`,
      )
    }
    for (const pool of [
      'attendanceMirror',
      't4Pool',
      't4PoolSwappedOut',
      't4PoolRehomed',
    ] as const) {
      usersRepo.selection(pool)
    }
  },
})

export default plugin

/**
 * `users` is the public contract of this entry. `notifications`, `passwordResets`, `loginThrottle`
 * and `userSettings` are OWNER-INTERNAL (M01 only): other modules must not import them. They are
 * exported for M01's own tests; a consumer that needs one asks M01 for a contract first.
 */
export const { users, notifications, passwordResets, loginThrottle, userSettings } =
  plugin.repositories

export type { UserSettings } from '../api/types'
/** School-admin impersonation switch (XR-M27-21, M27-T0b). */
export {
  ImpersonationError,
  impersonation,
  type ImpersonationAuditRow,
  type ImpersonationErrorCode,
  type ImpersonationReturnTo,
} from './impersonation'
/** Anchor rows of the users dataset (for consumers that must not copy id blocks). */
export { anchorUserIds, isAnchorUser } from './anchor-ids'

export type {
  SessionUserRow,
  SubscriptionPackage,
  UserPool,
  UserRole,
  UserRow,
  UserSecretsRow,
} from './datasets/users-types'
export { isSessionUser } from './datasets/users-types'
/** Fictitious IC of an M02 complimentary fixture (5901–5989; 5990 has none), M02 §6.14. */
export { complimentaryIc } from './datasets/users-anchors'
export {
  emailKey,
  hashSecret,
  maskIc,
  randomSalt,
  seedSalt,
  TRIAL_LIMIT,
  type AdminUserFilter,
  type FixtureSecret,
  type RoleCounts,
  type UserVisibility,
  type TrialStatus,
  type UserInput,
  type UserPatch,
  type UsersRepository,
} from './repository/users'
