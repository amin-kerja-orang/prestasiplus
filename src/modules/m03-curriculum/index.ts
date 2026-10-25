import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M03 public entry (F-01 stub, ADR-0009). Other modules import this module only from here.
 * Public exports are added by the module's mock task (T1) and the tasks named in build-plan §S.3 rule 6.
 */
/**
 * The DSKP catalogue (FB-026, DSKP-T02, ADR-0022): read-only, lazy per subject. Other modules read
 * it only through this export (UI and server code) or `@/modules/m03-curriculum/mock` (mock code).
 */
export * from './dskp'

export const manifest: ModuleManifest = {
  id: 'M03',
  slug: 'm03-curriculum',
  routes,
}
