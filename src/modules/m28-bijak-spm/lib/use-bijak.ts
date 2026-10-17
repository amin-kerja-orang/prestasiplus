/** Small page composables for Bijak SPM. */
import { computed, type ComputedRef } from 'vue'

import { useSession } from '@/composables/useSession'
import { useThemeMode } from '@/theme/color-mode'

/** The logged-in student's id (0 when there is no session; routes require one). */
export function useBijakUser(): ComputedRef<number> {
  const { user } = useSession()
  return computed(() => user.value?.id ?? 0)
}

/**
 * Bijak SPM is a learner screen: registers the learner personality while a page is mounted (the
 * portal layout does the same once the learner layout is in place; a stack, so both is harmless).
 */
export function useLearnerTheme(): void {
  useThemeMode('learner')
}

export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(ms),
  )
}
