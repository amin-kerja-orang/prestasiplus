/**
 * Prototype scope (D43) for components: `allows(path)` is false for a link that leads outside the
 * role's allowed screens, so the page hides it instead of sending the user to the "Belum tersedia"
 * page. `home` is the role's own dashboard (a teacher or school admin has no `/dashboard`).
 * Always true when `VITE_PROTOTYPE_SCOPE=off`.
 */
import { computed } from 'vue'

import { isPathAllowed, isPrototypeScopeOn, shellHomePath } from '@/app/prototype-scope'
import { useSessionStore } from '@/stores/session'

export function usePrototypeScope() {
  // With the scope off the session is never read, so a component mounted without Pinia still works.
  const session = isPrototypeScopeOn() ? useSessionStore() : null
  const allows = (path: string): boolean => isPathAllowed(session?.role ?? null, path)
  const home = computed(() => shellHomePath(session?.role ?? null))
  return { allows, home }
}
