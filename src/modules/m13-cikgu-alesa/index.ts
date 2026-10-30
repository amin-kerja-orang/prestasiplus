import type { ModuleManifest } from '@/app/modules'

import { whenAlesaAi } from '@/app/features'

import routes from './routes'

/**
 * M13 public entry (F-31 stub, ADR-0009 Amendment 2). Other modules import this module only from here.
 * Public exports are added by the module's mock task (T1) and the tasks named in build-plan §S.3 rule 6.
 */
export const manifest: ModuleManifest = {
  id: 'M13',
  slug: 'm13-cikgu-alesa',
  // Hidden behind VITE_ALESA_AI (D73): the paths then fall to the core 404 like an unbuilt route.
  routes: whenAlesaAi(routes),
}
