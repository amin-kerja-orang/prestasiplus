import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M09 public entry (ADR-0009). Other modules import this module only from here.
 * Public exports: the typed client functions and types of the reader endpoints (`./api`, M09-T1:
 * §7 #6–#9, #20, #24–#40, #43). Public components are added by the tasks named in build-plan §S.3
 * rule 6.
 */
export const manifest: ModuleManifest = {
  id: 'M09',
  slug: 'm09-content',
  routes,
}

export * from './api/content'
export type * from './api/types'
