import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

export * from './api'

/**
 * M21 public entry (F-31b stub, ADR-0009 Amendment 2). Other modules import this module only from here.
 * M21-T1: the student client `submitFosterApplication` (#15) and the contract types / enumerations of
 * `./api/types`, which M21-T2 (S6) calls. The mock repositories and `sponsorship` are public from
 * `@/modules/m21-sponsorship/mock`.
 */
export const manifest: ModuleManifest = {
  id: 'M21',
  slug: 'm21-sponsorship',
  routes,
}
