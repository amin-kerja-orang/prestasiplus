import { defineAsyncComponent } from 'vue'

import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

export * from './api/dashboard'
export * from './api/essay-review'
export * from './api/pending-teachers'
export * from './api/school-admin'

/**
 * M27 public entry (ADR-0009). Other modules import this module only from here.
 * Scaffolded by the S0 task (`/admin-sekolah`, roles-matrix row L07). Later M27 screens add their own
 * `routes/<group>.ts` fragment (spread in `routes.ts`), `mock/handlers/<group>.ts` (listed in
 * `mock/handlers/index.ts`) and `api/<group>.ts` (re-exported here).
 */
/**
 * The school-admin report pages, lazy. Each takes the optional props `schoolId`, `schoolName` and `basePath`:
 * M17 mounts them as the Admin Pusat central views with the school picked there (S6-T13, R1-ADM-M-07). With no
 * `schoolId` a page reads the school from the session, as for the school admin.
 */
export const LaporanAktivitiPage = defineAsyncComponent(() => import('./pages/LaporanAktivitiPage.vue'))
export const StatistikPenggunaanPage = defineAsyncComponent(
  () => import('./pages/StatistikPenggunaanPage.vue'),
)
export const DskpHeatmapPage = defineAsyncComponent(() => import('./pages/DskpHeatmapPage.vue'))
export const LaporanBulananPage = defineAsyncComponent(() => import('./pages/LaporanBulananPage.vue'))
export const AmaranSekolahPage = defineAsyncComponent(() => import('./pages/AmaranSekolahPage.vue'))

export const manifest: ModuleManifest = {
  id: 'M27',
  slug: 'm27-school-admin',
  routes,
}
