/**
 * The mock core (F-11; overview §6.9 phase 1, §7). Found by `src/mock/index.ts` through
 * `import.meta.glob('./core-data/index.ts')` and seeded before every module.
 *
 * - **Stores:** `auth.sessions` (`sessions` repository, owner core). The `users` store and
 *   `users.secrets` belong to M01 (F-23, `@/modules/m01-authentication/mock`); the canonical
 *   accounts 1–11 are literal anchors of that dataset.
 * - **Seed:** the canonical accounts' hashed secrets (`users.seedCanonical()`, `./accounts.ts`).
 * - **Session resolution:** `resolveCoreSession` (sliding 120 min / remember 5 years).
 * - **Routes:** `GET /api/me` (M01 #7), provisional `GET /api/me/gamification-summary`.
 * - **Hooks:** `setUser` (delegated built-in of `window.__mock`; writes `pp.auth`).
 *
 * Other mock code imports the repositories from here: `import { users, sessions } from
 * '@/mock/core-data'`.
 */

import { defineMockCore } from '../server/plugin'
import { sessions, sessionsTable } from '../auth/sessions'
import { CANONICAL_ACCOUNTS } from './accounts'
import { resolveCoreSession } from './resolve-session'
import { coreRoutes } from './routes'
import { bindCoreRuntime } from './runtime'
import { setUser } from './set-user'
import { users } from './users'

const core = defineMockCore({
  // v7: the sessions table gains `parentToken` (impersonation, XR-M27-21).
  version: 7,
  tables: { sessions: sessionsTable },
  repositories: { sessions },
  fixtures: { accounts: CANONICAL_ACCOUNTS },
  seed(ctx) {
    bindCoreRuntime(ctx.clock)
    users.seedCanonical()
  },
  resolveSession: resolveCoreSession,
  routes: coreRoutes,
  hooks: { setUser },
})

export default core

export { users, sessions }
export { CANONICAL_ACCOUNTS, CANONICAL_SCHOOL_IDS, DEMO_PASSWORD } from './accounts'
export type { CanonicalAccount, CanonicalRole } from './accounts'
export { issueSession, PP_AUTH_STORAGE_KEY, type ClientSession } from './client-session'
export { toUserMe, type SchoolSummary, type UserMe } from './me'
export type { CoreSession } from './resolve-session'
export { EMPTY_GAMIFICATION, type GamificationSummary } from './routes'
export type { UserRow } from './users'
export { landingPathFor, LANDING_PATHS } from '../auth/landing'
export { REMEMBER_LIFETIME_YEARS, SESSION_LIFETIME_MS, type SessionRow } from '../auth/sessions'
