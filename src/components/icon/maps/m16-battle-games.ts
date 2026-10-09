import { HandFist, Pencil } from '@lucide/vue'

import type { IconMap } from '../types'

/**
 * M16 Font Awesome -> Lucide rows that are not in the global table
 * (`fa-to-lucide.ts`, design-system.md §6). Owned by the M16 module tasks
 * (build-plan §S.3 rule 3); keys must not redefine a global row.
 *
 * The S6 hub buttons of Perang Fakta (`fa-fist-raised`) and Teka Silang Kata (`fa-pencil-alt`).
 */
export const iconMap: IconMap = {
  'fist-raised': HandFist,
  'pencil-alt': Pencil,
}
