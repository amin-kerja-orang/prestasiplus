/**
 * Feature flags read from the build environment, evaluated at call time (so tests can stub them).
 *
 * `VITE_KELUARGA_ANGKAT=on` shows the student page "Mohon Keluarga Angkat" (M21 S6, `/mohon-keluarga-angkat`).
 * It is OFF by default (TRACKER D74): the page was never requested for v2, so its menu item and route
 * are hidden (route unregistered -> 404). The backend endpoint and the access-matrix row are kept.
 */

/** Whether Mohon Keluarga Angkat (M21 S6) is shown. OFF unless `VITE_KELUARGA_ANGKAT=on`. */
export function isKeluargaAngkatOn(): boolean {
  return import.meta.env.VITE_KELUARGA_ANGKAT === 'on'
}

/** The routes of Mohon Keluarga Angkat: kept when the flag is on, none otherwise (unbuilt route -> 404). */
export function whenKeluargaAngkat<T>(routes: readonly T[]): T[] {
  return isKeluargaAngkatOn() ? [...routes] : []
}
