import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M16 public entry (F-31 stub, ADR-0009 Amendment 2). Other modules import this module only from here.
 * Public exports are added by the module's mock task (T1) and the tasks named in build-plan §S.3 rule 6.
 */

/** S30: the tournament banner, mounted by the user shell as the first child of `<main>` (SRS M16 §6.13). */
export { default as TournamentBanner } from './components/banner/TournamentBanner.vue'

export const manifest: ModuleManifest = {
  id: 'M16',
  slug: 'm16-battle-games',
  routes,
}
