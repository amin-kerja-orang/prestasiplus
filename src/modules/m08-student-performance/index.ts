import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M08 public entry (ADR-0009). Other modules import this module only from here.
 * Public exports: the typed client functions and types of the T1 endpoints (`./api`, M08-T1: §7 #1–#4,
 * #6, #7, #9–#11, #18–#23). The headcount client (`api/headcount*`) is added by M08-T1b.
 */
export const manifest: ModuleManifest = {
  id: 'M08',
  slug: 'm08-student-performance',
  routes,
}

export * from './api/performance'
export type * from './api/types'
