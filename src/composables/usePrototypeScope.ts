/**
 * Prototype scope (D43) for components: `allows(path)` is false for a link that leads outside the
 * role's allowed screens, so the page hides it instead of sending the user to the "Belum tersedia"
 * page. Always true when `VITE_PROTOTYPE_SCOPE=off`. `home` is the role's own home with the scope on
 * or off (`shellHomePath`: a teacher or school admin has no `/dashboard`).
 */
import { getActivePinia } from 'pinia'
import { computed } from 'vue'

import { isPathAllowed, shellHomePath } from '@/app/prototype-scope'
import { useSessionStore } from '@/stores/session'

export function usePrototypeScope() {
  // A component mounted without Pinia (unit tests) has no session: guest rules, `/dashboard` home.
  const session = getActivePinia() !== undefined ? useSessionStore() : null
  const allows = (path: string): boolean => isPathAllowed(session?.role ?? null, path)
  const home = computed(() => shellHomePath(session?.role ?? null))
  return { allows, home }
}
