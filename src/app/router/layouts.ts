/**
 * Layout resolution (overview §5.3, ADR-0008): route `meta.layout` + session → the shell to render.
 *
 * | `layout`         | Renders                                              |
 * |------------------|------------------------------------------------------|
 * | `admin`          | admin panel shell                                    |
 * | `user`           | user-portal shell                                    |
 * | `role`           | admin shell for role `admin`, user shell otherwise   |
 * | `public-or-user` | public layout for a guest, user shell when logged in |
 * | `bare`           | no shell: the page draws its full screen             |
 *
 * The admin shell is F-18 (`src/shells/admin/AdminShell.vue`), the user shell is F-19
 * (`src/shells/user/UserShell.vue`) and the public layout is F-20
 * (`src/shells/public/PublicLayout.vue`). Each is loaded lazily. (The F-13 placeholder frame,
 * `placeholders/PlaceholderShell.vue`, is no longer used by any entry.)
 */

import { defineAsyncComponent, type Component } from 'vue'

import type { Role } from '@/stores/session-types'

import type { LayoutMode } from './meta'

export type ShellKind = 'admin' | 'user' | 'public'

/** The shell for `mode`, or `null` for `bare`. Pure, for unit tests. */
export function resolveShell(
  mode: LayoutMode,
  session: { isLoggedIn: boolean; role: Role | null },
): ShellKind | null {
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

/** One component per shell. A shell stays mounted while consecutive routes resolve to it. */
export const shellComponents: Readonly<Record<ShellKind, Component>> = {
  // Loaded lazily so the router and its tests do not depend on the shell build (F13-2).
  admin: defineAsyncComponent(() => import('@/shells/admin/AdminShell.vue')), // F-18
  user: defineAsyncComponent(() => import('@/shells/user/UserShell.vue')), // F-19
  public: defineAsyncComponent(() => import('@/shells/public/PublicLayout.vue')), // F-20
}
