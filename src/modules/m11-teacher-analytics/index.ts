import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M11 public entry (ADR-0009). Other modules import this module only from here.
 * Public exports: the typed client functions and types of the M11 endpoints (`./api`, M11-T1: §7 #1,
 * #3–#8). The monitoring component M17 mounts (S2–S5) is exported by the task named in build-plan §S.3
 * rule 6 (M11-T3), after M11-T1.
 */
export const manifest: ModuleManifest = {
  id: 'M11',
  slug: 'm11-teacher-analytics',
  routes,
}

export * from './api'
