/**
 * Feature flags read from the build environment, evaluated at call time (so tests can stub them).
 *
 * `VITE_ALESA_AI=on` shows every ALESA / Cikgu Alesa AI surface. It is OFF by default (TRACKER D73):
 * none of them uses a real AI model yet (rule-based sentences or a mock provider), so the panels,
 * menu items, shortcuts and the M13 / SPM Walkthrough routes are hidden until a provider is wired.
 *
 * `VITE_KELUARGA_ANGKAT=on` shows the student page "Mohon Keluarga Angkat" (M21 S6, `/mohon-keluarga-angkat`).
 * It is OFF by default (TRACKER D74): the page was never requested for v2, so its menu item and route
 * are hidden (route unregistered -> 404). The backend endpoint and the access-matrix row are kept.
 *
 * `VITE_CENTRAL_REPORTS=on` shows the Admin Pusat central views of the school reports (M17 R1-ADM-M-07,
 * `/admin/laporan-sekolah/{view}`, S6-T13). It is OFF by default: the routes are not registered (global 404) until
 * the Portal Pentadbiran menu items PM-12..PM-28 point at them.
 */

/** Whether the ALESA AI surfaces are shown. OFF unless `VITE_ALESA_AI=on`. */
export function isAlesaAiOn(): boolean {
  return import.meta.env.VITE_ALESA_AI === 'on'
}

/** The routes of an ALESA AI page: kept when the flag is on, none otherwise (unbuilt route -> 404). */
export function whenAlesaAi<T>(routes: readonly T[]): T[] {
  return isAlesaAiOn() ? [...routes] : []
}

/** Whether Mohon Keluarga Angkat (M21 S6) is shown. OFF unless `VITE_KELUARGA_ANGKAT=on`. */
export function isKeluargaAngkatOn(): boolean {
  return import.meta.env.VITE_KELUARGA_ANGKAT === 'on'
}

/** The routes of Mohon Keluarga Angkat: kept when the flag is on, none otherwise (unbuilt route -> 404). */
export function whenKeluargaAngkat<T>(routes: readonly T[]): T[] {
  return isKeluargaAngkatOn() ? [...routes] : []
}

/** Whether the Admin Pusat central report views (M17 R1-ADM-M-07) are on. OFF unless `VITE_CENTRAL_REPORTS=on`. */
export function isCentralReportsOn(): boolean {
  return import.meta.env.VITE_CENTRAL_REPORTS === 'on'
}

/** The routes of the central report views: kept when the flag is on, none otherwise (unbuilt route -> 404). */
export function whenCentralReports<T>(routes: readonly T[]): T[] {
  return isCentralReportsOn() ? [...routes] : []
}
