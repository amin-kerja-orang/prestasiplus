import type { AuthContext } from '../../../common/scope/auth-context'
import { idFromString } from '../../../db/ids'

/** Admin Pusat sees every batch; a Guru only the ones they own. Anything else never reaches the service (RolesGuard). */
export function isAdmin(auth: AuthContext): boolean {
  return auth.active.role === 'admin'
}

/** Prisma `where` fragment for `intake_batches` that the caller may see. */
export function visibleBatches(auth: AuthContext): { ownerUserId?: bigint } {
  return isAdmin(auth) ? {} : { ownerUserId: idFromString(auth.userId) }
}

/** Decimal-string path id to bigint, or null when it is not a valid id (the caller answers 404). */
export function parseId(text: string): bigint | null {
  try {
    return idFromString(text)
  } catch {
    return null
  }
}
