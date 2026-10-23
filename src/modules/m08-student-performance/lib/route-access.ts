/**
 * `useCanOpen()` -> `canOpen(path)`: whether the signed-in viewer can open the screen behind an in-page
 * link, so a link the route guard would refuse (403, 404 or the "Belum tersedia" page) is not shown
 * (D9 dead link). A path can be opened when it resolves to a real route (not the catch-all 404), the
 * route's `meta.roles` (when it has any) contains the session role, and the prototype scope allows it.
 * Reads the session only.
 */
import { useRouter } from 'vue-router'

import { NOT_FOUND_ROUTE_NAME, usePrototypeScope } from '@/composables'
import { useSessionStore } from '@/stores/session'

export function useCanOpen() {
  const router = useRouter()
  const session = useSessionStore()
  const { allows } = usePrototypeScope()

  const canOpen = (path: string): boolean => {
    const resolved = router.resolve(path)
    if (resolved.matched.length === 0 || resolved.name === NOT_FOUND_ROUTE_NAME) return false
    const roles = resolved.meta.roles as readonly string[] | undefined
    if (roles && (session.role === null || !roles.includes(session.role))) return false
    return allows(path)
  }
  return { canOpen }
}
