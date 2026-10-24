/**
 * Mod Pelajar (v2-portals US-07, contract `Session.mode`): an admin opens the learner portal as the
 * demo student and can always return. Mock: the demo student's session comes from the M02 "Login As"
 * endpoint (the admin token stays valid) and the admin session is parked inside `pp.auth`
 * (`session.mode`); "Keluar Mod Pelajar" restores it. Test student only (`isTest`).
 */
import { api } from '@/api'
import { useSessionStore } from '@/stores/session'
import type { UserMe } from '@/stores/session-types'

/** Canonical demo student ("Pelajar Demo", `pelajar@demo.test`). */
export const MOD_PELAJAR_STUDENT_ID = 2
/** Where "Keluar Mod Pelajar" lands for an admin. */
export const MOD_PELAJAR_RETURN = '/admin/command-center'
export const MOD_PELAJAR_HOME = '/dashboard'

/** Opens Mod Pelajar and resolves to the learner home path. Rejects when the switch is refused. */
export async function enterModPelajar(): Promise<string> {
  const session = useSessionStore()
  if (session.role !== 'admin') throw new Error('Mod Pelajar hanya untuk admin')
  const student = await api.post<{ token: string; expiresAt: string; user: UserMe }>(
    `/api/admin/users/${String(MOD_PELAJAR_STUDENT_ID)}/impersonate`,
  )
  if (!session.enterModPelajar(student, MOD_PELAJAR_RETURN)) throw new Error('Mod Pelajar sedang aktif')
  return MOD_PELAJAR_HOME
}

/** Closes Mod Pelajar and resolves to the path of the restored admin session (`/login` if it ended). */
export function leaveModPelajar(): string {
  return useSessionStore().leaveModPelajar() ?? '/login'
}
