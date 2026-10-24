import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import { useApi } from '@/composables/useApi'

import { bijakServer } from '../server/client'
import { useBijakUser } from './use-bijak'

/**
 * Public contract for other modules (the SPM hub): how many Bijak SPM papers a learner can open
 * ("Kertas Pilihan"). Computed from the same published list the Bijak hub shows, never a constant;
 * `null` until the list has loaded or if it fails (callers then show nothing).
 */
export function useBijakPaperCount(): ComputedRef<number | null> {
  const user = useBijakUser()
  const { data } = useApi(() => bijakServer().listPapers(user.value))
  return computed(() => (data.value ? data.value.length : null))
}
