import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M10 public entry (F-01 stub, ADR-0009). Other modules import this module only from here.
 * Public exports: the typed client functions and types of the T1 endpoints (`./api`, M10-T1: §7 #1,
 * #11–#17, #35–#44, #51–#58, #73–#75). Public components are added by the tasks named in build-plan
 * §S.3 rule 6.
 */
export const manifest: ModuleManifest = {
  id: 'M10',
  slug: 'm10-teacher-class',
  routes,
}

export * from './api/guru'
export type * from './api/types'
