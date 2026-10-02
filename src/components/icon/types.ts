import type { LucideIcon } from '@lucide/vue'

/**
 * A module's extra Font Awesome -> Lucide rows (build-plan §S.3 rule 3).
 * Keyed by the FA name without the `fa-` prefix (`'bullhorn'`), valued by the
 * statically imported Lucide component (`Megaphone`), so it stays tree-shaken.
 */
export type IconMap = Readonly<Record<string, LucideIcon>>
