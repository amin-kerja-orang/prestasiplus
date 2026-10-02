import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M14 public entry (F-31 stub, ADR-0009 Amendment 2). Other modules import this module only from here.
 *
 * Public exports: the typed client functions and types of the M14 endpoints (`./api`, SRS M14 v1.8
 * §7 #2–#43; #1 is the shell's own read of `GET /api/me/gamification-summary`). Screens, routes and
 * components are added by the screen tasks (build-plan §S.3 rule 6).
 */
export const manifest: ModuleManifest = {
  id: 'M14',
  slug: 'm14-gamification',
  routes,
}

export * from './api'
