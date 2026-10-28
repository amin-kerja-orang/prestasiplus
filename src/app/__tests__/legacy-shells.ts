/**
 * Test helper: the legacy shell choice (F-18 admin shell, F-19 user shell) for every role. The real
 * `layouts.ts` frames the v2 roles in the Pembelajaran / Pentadbiran layouts in every build; the
 * legacy shells remain only for the roles outside v2 (parent, sponsor, PPD/JPN). Specs that cover
 * the legacy shell components themselves use this through `vi.mock('@/app/router/layouts', ...)`
 * so they keep mounting those shells with their existing student / teacher / admin fixtures.
 */
import type { Role } from '@/stores/session-types'

import type * as Layouts from '../router/layouts'
import type { LayoutMode } from '../router/meta'

export function legacyResolveShell(
  mode: LayoutMode,
  session: { isLoggedIn: boolean; role: Role | null },
): Layouts.ShellKind | null {
  switch (mode) {
    case 'admin':
      return 'admin'
    case 'user':
      return 'user'
    case 'role':
      return session.role === 'admin' ? 'admin' : 'user'
    case 'public-or-user':
      return session.isLoggedIn ? 'user' : 'public'
    case 'bare':
      return null
  }
}

/** A `vi.mock` factory body for `@/app/router/layouts` that forces the legacy shells. */
export async function legacyLayoutsModule(
  importOriginal: () => Promise<typeof Layouts>,
): Promise<typeof Layouts> {
  const actual = await importOriginal()
  return {
    ...actual,
    userShellFor: () => 'user',
    adminShellFor: () => 'admin',
    resolveShell: legacyResolveShell,
    resolveShellForPath: (mode, session) => legacyResolveShell(mode, session),
  }
}
