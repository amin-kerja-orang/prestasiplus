import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M01 public entry (ADR-0009). Other modules import this module only from here.
 * Public exports: the typed client functions and types of the auth and account endpoints
 * (`./api`, M01-T1). Public components are added by the tasks named in build-plan §S.3 rule 6.
 */
export const manifest: ModuleManifest = {
  id: 'M01',
  slug: 'm01-authentication',
  routes,
}

export * from './api/account'
export * from './api/auth'
export * from './api/stats'
export type * from './api/types'
