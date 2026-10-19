import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

export * from './api/command-center'
export * from './api/command-center-board'
export * from './components/command-center'
export { commandCenterDrillRoutes } from './routes/command-center'
export type { CommandCenterDrillRouteOptions } from './routes/command-center'

/**
 * M17 public entry (F-31 stub, ADR-0009 Amendment 2). Other modules import this module only from here.
 * Public exports are added by the module's mock task (T1) and the tasks named in build-plan §S.3 rule 6.
 * M17-T1a: the Command Center drill-down client (`fetchCc*`) and its response types (SRS §7 #6–#13), which
 * M17-T3a (S4–S7) and the M10 `/guru/command-center/…` mount (M10-T4) call. M17-T3a: the S4–S7 pages
 * (`CommandCenter{School,Teacher,Class,Student}Page`, lazy; props `basePath` + ids) and
 * `commandCenterDrillRoutes({prefix, namePrefix, roles})` for the M10 and Admin Sekolah mounts.
 */
export const manifest: ModuleManifest = {
  id: 'M17',
  slug: 'm17-admin-dashboard',
  routes,
}
