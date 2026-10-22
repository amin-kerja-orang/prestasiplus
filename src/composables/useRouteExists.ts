/**
 * `routeExists(path)`: whether the router has a real screen for `path` (the catch-all 404 does not
 * count). Pages use it to hide or de-link a link whose target module is not built yet, so the user
 * is never sent to "Halaman Tidak Dijumpai" (D9, dead link).
 */
import { useRouter } from 'vue-router'

export const NOT_FOUND_ROUTE_NAME = 'core.not-found'

export function useRouteExists() {
  const router = useRouter()
  const routeExists = (path: string): boolean => {
    const resolved = router.resolve(path)
    return resolved.matched.length > 0 && resolved.name !== NOT_FOUND_ROUTE_NAME
  }
  return { routeExists }
}
