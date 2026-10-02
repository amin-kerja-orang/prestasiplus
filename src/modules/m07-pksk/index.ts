import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M07 public entry (F-01 stub, ADR-0009). Other modules import this module only from here.
 * Public exports are added by the module's mock task (T1) and the tasks named in build-plan §S.3 rule 6.
 */
export const manifest: ModuleManifest = {
  id: 'M07',
  slug: 'm07-pksk',
  routes,
}
