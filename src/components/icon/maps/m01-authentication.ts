import type { IconMap } from '../types'

/**
 * M01 Font Awesome -> Lucide rows that are not in the global table
 * (`fa-to-lucide.ts`, design-system.md §6). Owned by the M01 module tasks
 * (build-plan §S.3 rule 3); keys must not redefine a global row.
 *
 * Example: `import { Megaphone } from '@lucide/vue'` then `bullhorn: Megaphone`.
 */
export const iconMap: IconMap = {}
