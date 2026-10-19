import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

export * from './api/dashboard'
export * from './api/school-admin'

/**
 * M27 public entry (ADR-0009). Other modules import this module only from here.
 * Scaffolded by the S0 task (`/admin-sekolah`, roles-matrix row L07). Later M27 screens add their own
 * `routes/<group>.ts` fragment (spread in `routes.ts`), `mock/handlers/<group>.ts` (listed in
 * `mock/handlers/index.ts`) and `api/<group>.ts` (re-exported here).
 */
export const manifest: ModuleManifest = {
  id: 'M27',
  slug: 'm27-school-admin',
  routes,
}
