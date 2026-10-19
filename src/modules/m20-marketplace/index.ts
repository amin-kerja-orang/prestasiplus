import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M20 public entry (F-31b stub, ADR-0009 Amendment 2). Other modules import this module only from here.
 * Public exports are added by the module's mock task (T1) and the tasks named in build-plan §S.3 rule 6.
 */
export const manifest: ModuleManifest = {
  id: 'M20',
  slug: 'm20-marketplace',
  routes,
}
