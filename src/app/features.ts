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
 */

import { FEATURE_ROUTE_PREFIXES, pathHasPrefix } from '@pp/contract'
import { getActivePinia } from 'pinia'

import { useSessionStore } from '@/stores/session'

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

/**
 * Server feature flags (S0-T10, D115): `GET /api/session` carries `features: Record<string, boolean>`
 * (Kawalan Ciri). A key that is absent counts as ON (fail-open, FR-ADM-N06.4), as does a session
 * that has no map (mock mode, logged out, no active Pinia).
 */
export function isServerFeatureOn(key: string): boolean {
  // No active Pinia (before boot, plain unit tests) means no session: absent = ON (FR-ADM-N06.4, fail-open).
  if (getActivePinia() === undefined) return true
  // `features` is optional on the session (login, role and mode responses do not carry it): absent = ON.
  return useSessionStore().features[key] !== false
}

/**
 * Whether `path` (no query) belongs to a page of a feature that is switched OFF (Kawalan Ciri): it lies under
 * one of the key's `fe` prefixes (segment boundary, `/permainanx` is not `/permainan`) and under none of its
 * `feExcept` paths. The router answers the standard 404 page for such a path (AC-ADM-N06.1).
 */
export function isFeatureRouteOff(path: string): boolean {
  return Object.entries(FEATURE_ROUTE_PREFIXES).some(
    ([key, p]) =>
      !isServerFeatureOn(key) &&
      p.fe.some((prefix) => pathHasPrefix(path, prefix)) &&
      !(p.feExcept ?? []).some((except) => pathHasPrefix(path, except)),
  )
}

/** The build-time flag AND the server flag: a feature is shown only when both are on. */
export function isFeatureOn(key: string, buildFlag = true): boolean {
  return buildFlag && isServerFeatureOn(key)
}

/**
 * Menu item id -> Kawalan Ciri key, for the items an OFF flag removes (FR-ADM-N06.3, AC-ADM-N06.1).
 * `latih-tubi` hides only the Latih Tubi item; the Cikgu Alesa chat shortcut shares `/cikgu`.
 * `kemajuan-saya` and `sejarah-latihan` have no menu item (pupil home shortcuts only).
 */
export const NAV_FEATURE_KEYS: Readonly<Record<string, string>> = {
  permainan: 'permainan',
  'latih-tubi': 'latih-tubi',
  'cikgu-alesa': 'cikgu-alesa',
  'cikgu-alesa-chat': 'cikgu-alesa',
  'mohon-keluarga-angkat': 'keluarga-angkat',
  // S0-T11: the other 28 keys. A shared page is governed by the key whose label it carries, for every role (D-3):
  // the pupil, teacher (`t-`) and school-admin (`sa-`) items of one route all go.
  'misi-harian': 'misi-harian',
  kombo: 'kombo',
  'sa-kombo-harian': 'kombo',
  't-kombo': 'kombo',
  'papan-pendahulu': 'leaderboard',
  remedial: 'remedial',
  'cita-cita-saya': 'cita-cita',
  'cita-cita-hijrah': 'cita-cita',
  universiti: 'universiti',
  biasiswa: 'biasiswa',
  'target-spm': 'target-spm',
  'analisa-item': 'analisa-item',
  'sa-analisa-item': 'analisa-item',
  't-analisa-item': 'analisa-item',
  prestasi: 'prestasi',
  'sa-prestasi': 'prestasi',
  psikometrik: 'psikometrik',
  'profil-cerah': 'profil-cerah',
  'profil-cerah-ai': 'profil-cerah',
  video: 'video-pembelajaran',
  'sa-video': 'video-pembelajaran',
  't-video': 'video-pembelajaran',
  perutusan: 'perutusan',
  'sa-perutusan': 'perutusan',
  't-perutusan': 'perutusan',
  panduan: 'panduan-pengguna',
  'sa-panduan': 'panduan-pengguna',
  't-panduan': 'panduan-pengguna',
  'tiket-bantuan': 'tiket-bantuan',
  headcount: 'guru.headcount',
  'sa-headcount': 'guru.headcount',
  't-headcount': 'guru.headcount',
  't-misi-harian': 'guru.misi-harian',
  't-kelas-saya': 'guru.kelas',
  'kelas-guru': 'guru.kelas',
  't-prestasi': 'guru.prestasi',
  't-monitoring': 'guru.monitoring',
  't-analisis-item': 'guru.analisis-item',
  't-syiling-ganjaran': 'guru.gamifikasi',
  't-broadcast': 'guru.broadcast',
  't-databank': 'guru.databank',
  't-sumbang-soalan': 'guru.sumbang-soalan',
  'sumbang-soalan': 'guru.sumbang-soalan',
}
