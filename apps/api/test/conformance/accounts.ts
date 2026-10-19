import type { ActorRole } from '@pp/contract-tests'

/**
 * Seeded accounts the conformance run signs in as, per scenario role.
 *
 * HOOK FOR BE-07 (demo accounts seed): today these are the accounts of the core identity seed
 * (`prisma/seed/core/identity.ts`, password `Demo1234`, the documented demo exception). When BE-07
 * merges, point this table at its accounts (or read them from its exported list) and widen the seed
 * list in `boot.ts`. Nothing else in the suite names an account.
 */
export const DEMO_PASSWORD = 'Demo1234'

export const ACCOUNTS: Partial<Record<ActorRole, string>> = {
  student: 'pelajar@demo.test',
  teacher: 'guru@demo.test',
  school_admin: 'adminsekolah@demo.test',
  admin: 'admin@demo.test',
  // ppd_officer and jpn_officer have no seeded account yet: a scenario that asks for one fails with
  // a clear message instead of guessing.
}

/** A teacher + school_admin account, for the role-switch scenario. */
export const DUAL_ROLE_ACCOUNT = 'guruadmin@demo.test'
/** A second student of the same school (for ownership scenarios). */
export const OTHER_STUDENT = 'pelajar2@demo.test'

export function accountFor(role: ActorRole): { identifier: string; password: string } {
  const identifier = ACCOUNTS[role]
  if (!identifier) throw new Error(`no seeded account for role ${role} yet (see accounts.ts, BE-07 hook)`)
  return { identifier, password: DEMO_PASSWORD }
}
