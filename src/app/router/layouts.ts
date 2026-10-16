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

import { isPrototypeScopeOn } from '../prototype-scope'

import type { LayoutMode } from './meta'

export type ShellKind = 'admin' | 'user' | 'pembelajaran' | 'public'

/**
 * The frame of a logged-in user: the v2 Pembelajaran layout for the student and the teacher (the
 * prototype portal roles) while the prototype scope is on (D43); the legacy user shell for every
 * other role and for the unscoped e2e build.
 */
export function userShellFor(role: Role | null): ShellKind {
  return isPrototypeScopeOn() && (role === 'student' || role === 'teacher')
    ? 'pembelajaran'
    : 'user'
}

/** The shell for `mode`, or `null` for `bare`. Pure, for unit tests. */
export function resolveShell(
  mode: LayoutMode,
  session: { isLoggedIn: boolean; role: Role | null },
): ShellKind | null {
  switch (mode) {
    case 'admin':
      return 'admin'
    case 'user':
      return userShellFor(session.role)
    case 'role':
      return session.role === 'admin' ? 'admin' : userShellFor(session.role)
    case 'public-or-user':
      return session.isLoggedIn ? userShellFor(session.role) : 'public'
    case 'bare':
      return null
  }
}

/** One component per shell. A shell stays mounted while consecutive routes resolve to it. */
export const shellComponents: Readonly<Record<ShellKind, Component>> = {
  // Loaded lazily so the router and its tests do not depend on the shell build (F13-2).
  admin: defineAsyncComponent(() => import('@/shells/admin/AdminShell.vue')), // F-18
  user: defineAsyncComponent(() => import('@/shells/user/UserShell.vue')), // F-19
  pembelajaran: defineAsyncComponent(() => import('@/shells/pembelajaran/PembelajaranLayout.vue')), // V2-T15 subset (student, teacher)
  public: defineAsyncComponent(() => import('@/shells/public/PublicLayout.vue')), // F-20
}
