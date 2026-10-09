import { HatGlasses } from '@lucide/vue'

import type { IconMap } from '../types'

/**
 * M27 Font Awesome -> Lucide rows that are not in the global table
 * (`fa-to-lucide.ts`, design-system.md §6). Owned by the M27 module tasks
 * (build-plan §S.3 rule 3); keys must not redefine a global row.
 *
 * The S6/S7 "Menyamar" button (`fa-user-secret`, FR-M27-121; approximation).
 */
export const iconMap: IconMap = {
  'user-secret': HatGlasses,
}
