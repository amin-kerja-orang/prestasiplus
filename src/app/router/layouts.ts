/**
 * Layout resolution (overview §5.3, ADR-0008): route `meta.layout` + session → the shell to render.
 *
 * | `layout`         | Renders                                                  |
 * |------------------|----------------------------------------------------------|
 * | `admin`          | admin frame of the role (`adminShellFor`)                |
 * | `user`           | user frame of the role (`userShellFor`)                  |
 * | `role`           | admin frame for role `admin`, user frame otherwise       |
 * | `public-or-user` | public layout for a guest, user frame when logged in     |
 * | `bare`           | no shell: the page draws its full screen (see below)     |
 *
 * The v2 frames (Pembelajaran for student / teacher / school admin, Pentadbiran for Admin Pusat)
 * are chosen by role alone, whatever `VITE_PROTOTYPE_SCOPE` says; the legacy shells remain for the
 * roles outside v2.
 *
 * The admin shell is F-18 (`src/shells/admin/AdminShell.vue`), the user shell is F-19
 * (`src/shells/user/UserShell.vue`) and the public layout is F-20
 * (`src/shells/public/PublicLayout.vue`). Each is loaded lazily. (The F-13 placeholder frame,
 * `placeholders/PlaceholderShell.vue`, is no longer used by any entry.)
 */

import { defineAsyncComponent, type Component } from 'vue'

import type { Role } from '@/stores/session-types'

import type { LayoutMode } from './meta'

export type ShellKind = 'admin' | 'user' | 'pembelajaran' | 'pentadbiran' | 'public'

/**
 * The frame of a logged-in user: the v2 Pembelajaran layout for the student, the teacher and the
 * school admin, the v2 Portal Pentadbiran for Admin Pusat (D29, D30, D43); the legacy user shell for
 * every role outside v2 (parent, sponsor, PPD/JPN). The same in every build: the prototype scope
 * (`VITE_PROTOTYPE_SCOPE`) only hides routes, menus and roles, it never picks the shell.
 */
export function userShellFor(role: Role | null): ShellKind {
  if (role === 'student' || role === 'teacher' || role === 'school_admin') return 'pembelajaran'
  // Admin Pusat keeps its own portal on the shared account screens (Profil, Tetapan, Tiket).
  return role === 'admin' ? 'pentadbiran' : 'user'
}

/**
 * The admin frame: the v2 Portal Pentadbiran for Admin Pusat (D30, D48), the staff Pembelajaran
 * layout for the teacher and the school admin (Monitoring, Kirkpatrick); the legacy admin shell for
 * every other role. Independent of the prototype scope, like `userShellFor`.
 */
export function adminShellFor(role: Role | null): ShellKind {
  if (role === 'admin') return 'pentadbiran'
  // Guru and Admin Sekolah screens on the admin layout (Monitoring, Kirkpatrick) use the staff shell.
  return role === 'teacher' || role === 'school_admin' ? 'pembelajaran' : 'admin'
}

/** Standalone (`bare`) admin screens that sit inside the Pentadbiran portal for Admin Pusat. */
const BARE_IN_PORTAL = ['/admin/command-center']

/**
 * `resolveShell`, plus the portal frame for the admin Command Center boards (layout `bare`), in
 * every build (scope on or off).
 */
export function resolveShellForPath(
  mode: LayoutMode,
  session: { isLoggedIn: boolean; role: Role | null },
  path: string,
): ShellKind | null {
  if (
    mode === 'bare' &&
    session.role === 'admin' &&
    BARE_IN_PORTAL.some((p) => path === p || path.startsWith(`${p}/`))
  ) {
    return 'pentadbiran'
  }
  return resolveShell(mode, session)
}

/** The shell for `mode`, or `null` for `bare`. Pure, for unit tests. */
export function resolveShell(
  mode: LayoutMode,
  session: { isLoggedIn: boolean; role: Role | null },
): ShellKind | null {
  switch (mode) {
    case 'admin':
      return adminShellFor(session.role)
    case 'user':
      return userShellFor(session.role)
    case 'role':
      return session.role === 'admin' ? adminShellFor('admin') : userShellFor(session.role)
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
  pentadbiran: defineAsyncComponent(() => import('@/shells/pentadbiran/PentadbiranLayout.vue')), // V2-T13/T14 PoC (Admin Pusat)
  public: defineAsyncComponent(() => import('@/shells/public/PublicLayout.vue')), // F-20
}
