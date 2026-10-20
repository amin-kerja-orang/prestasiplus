/**
 * Mod Pelajar (v2-portals US-07, contract `Session.mode`): an admin opens the learner portal as the
 * demo student and can always return. Mock: the demo student's session comes from the M02 "Login As"
 * endpoint (the admin token stays valid) and the admin session is parked inside `pp.auth`
 * (`session.mode`); "Keluar Mod Pelajar" restores it. Test student only (`isTest`).
 *
 * Http (`VITE_API_MODE=http`): a server-side mode. `POST /api/session/mode {mode:'mod_pelajar'}`
 * (admin and school_admin) and `DELETE /api/session/mode`; the contract `Session` they return
 * replaces the stored one (new csrf, active role, landing, `mode`). Attempts made in it are `is_test`.
 */
import { api, isHttpMode } from '@/api'
import { scopeHomePath } from '@/app/prototype-scope'
import { isApiSession, toClientSessionFromApi } from '@/stores/http-session'
import { useSessionStore } from '@/stores/session'
import type { UserMe } from '@/stores/session-types'

/** Canonical demo student ("Pelajar Demo", `pelajar@demo.test`). */
export const MOD_PELAJAR_STUDENT_ID = 2
/** Where "Keluar Mod Pelajar" lands for an admin. */
export const MOD_PELAJAR_RETURN = '/admin/command-center'
export const MOD_PELAJAR_HOME = '/dashboard'

type SessionStore = ReturnType<typeof useSessionStore>

/** Applies the Session an http mode call returned; with no Session body it falls back to `/api/me`. */
async function applyHttpSession(session: SessionStore, body: unknown): Promise<void> {
  if (isApiSession(body)) session.setSession(toClientSessionFromApi(body, session.remember))
  else await session.refreshUser()
}

async function enterHttp(session: SessionStore): Promise<string> {
  if (session.role !== 'admin' && session.role !== 'school_admin')
    throw new Error('Mod Pelajar is for the admin')
  if (session.mode) throw new Error('Mod Pelajar is on')
  const body = await api.post<unknown>('/api/session/mode', { body: { mode: 'mod_pelajar' } })
  await applyHttpSession(session, body)
  return session.landingPath ?? '/'
}

/** Opens Mod Pelajar and resolves to the learner home path. Rejects when the switch is refused. */
export async function enterModPelajar(): Promise<string> {
  const session = useSessionStore()
  if (isHttpMode()) return enterHttp(session)
  if (session.role !== 'admin') throw new Error('Mod Pelajar is for the admin')
  const student = await api.post<{ token: string; expiresAt: string; user: UserMe }>(
    `/api/admin/users/${String(MOD_PELAJAR_STUDENT_ID)}/impersonate`,
  )
  if (!session.enterModPelajar(student, MOD_PELAJAR_RETURN)) throw new Error('Mod Pelajar is on')
  return MOD_PELAJAR_HOME
}

/** Closes Mod Pelajar and resolves to the path of the restored admin session (`/login` if it ended). */
export function leaveModPelajar(): string {
  return useSessionStore().leaveModPelajar() ?? '/login'
}

/** Http mode: `DELETE /api/session/mode`, then the staff home. Rejects when the API refuses. */
async function leaveHttp(): Promise<string> {
  const session = useSessionStore()
  await applyHttpSession(session, await api.delete<unknown>('/api/session/mode'))
  return session.role ? scopeHomePath(session.role) : '/login'
}

/** Closes Mod Pelajar in either mode (the banner uses this). */
export async function exitModPelajar(): Promise<string> {
  return isHttpMode() ? leaveHttp() : leaveModPelajar()
}
