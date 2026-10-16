/**
 * Thin adapter between the Pembelajaran layout and the current session store, so the layout can be
 * switched to Session v2 later by changing this one file. Reads role and display name only.
 */
import { computed } from 'vue'

import { useSessionStore } from '@/stores/session'
import type { Role } from '@/stores/session-types'

export function useShellUser() {
  const session = useSessionStore()
  const role = computed<Role | null>(() => session.role)
  const name = computed(() => session.user?.name ?? '')
  const schoolName = computed(() => session.user?.school?.name ?? '')
  const isLoggedIn = computed(() => session.isLoggedIn)
  return { role, name, schoolName, isLoggedIn }
}
