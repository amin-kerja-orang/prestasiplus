import { Workflow } from '@lucide/vue'

import type { IconMap } from '../types'

/**
 * M12 Font Awesome -> Lucide rows that are not in the global table
 * (`fa-to-lucide.ts`, design-system.md §6). Owned by the M12 module tasks
 * (build-plan §S.3 rule 3); keys must not redefine a global row.
 *
 * The S1 card "Kirkpatrick Evaluation Flow" (`fa-project-diagram`; approximation, DV-M12-30).
 */
export const iconMap: IconMap = {
  'project-diagram': Workflow,
}
