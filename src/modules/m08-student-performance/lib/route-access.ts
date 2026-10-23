/**
 * `useCanOpen()` -> `canOpen(path)`: whether the signed-in viewer can open the screen behind an in-page
 * link, so a link the route guard would refuse (403, 404 or the "Belum tersedia" page) is not shown
 * (D9 dead link). A path can be opened when it resolves to a real route (not the catch-all 404), the
 * route's `meta.roles` (when it has any) contains the session role, and the prototype scope allows it.
 * Reads the session only. Without an active Pinia the session is never touched and the viewer counts as
 * signed out (role `null`): a route that declares `meta.roles` stays closed and the scope sees no role.
 */
import { getActivePinia } from 'pinia'
import { useRouter } from 'vue-router'

import { isPathAllowed } from '@/app/prototype-scope'
import { NOT_FOUND_ROUTE_NAME, usePrototypeScope } from '@/composables'
import { useSessionStore } from '@/stores/session'

export function useCanOpen() {
  const router = useRouter()
  // `usePrototypeScope` reads the session when the scope is on, so it is skipped without Pinia (fail closed).
  const hasPinia = getActivePinia() !== undefined
  const session = hasPinia ? useSessionStore() : null
  const allows = hasPinia
    ? usePrototypeScope().allows
    : (path: string): boolean => isPathAllowed(null, path)

  const canOpen = (path: string): boolean => {
    const resolved = router.resolve(path)
    if (resolved.matched.length === 0 || resolved.name === NOT_FOUND_ROUTE_NAME) return false
    const roles = resolved.meta.roles as readonly string[] | undefined
    if (roles && (!session?.role || !roles.includes(session.role))) return false
    return allows(path)
  }
  return { canOpen }
}
