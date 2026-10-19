import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M12 public entry (ADR-0009). Other modules import this module only from here.
 * Public exports: the typed client functions and types of the endpoints (`./api`, M12-T1: §7 #1-#14). Public
 * components are added by the tasks named in build-plan §S.3 rule 6.
 */
export const manifest: ModuleManifest = {
  id: 'M12',
  slug: 'm12-kirkpatrick',
  routes,
}

export * from './api/kirkpatrick'
export type * from './api/types'
