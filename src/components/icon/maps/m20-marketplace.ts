import { Truck } from '@lucide/vue'

import type { IconMap } from '../types'

/**
 * M20 Font Awesome -> Lucide rows that are not in the global table
 * (`fa-to-lucide.ts`, design-system.md §6). Owned by the M20 module tasks
 * (build-plan §S.3 rule 3); keys must not redefine a global row.
 *
 * The shipping line on the S6/S8 product cards and on S7 (`fa-truck`).
 */
export const iconMap: IconMap = {
  truck: Truck,
}
