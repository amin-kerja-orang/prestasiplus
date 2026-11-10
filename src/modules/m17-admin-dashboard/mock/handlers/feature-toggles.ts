/**
 * `GET /api/admin/feature-toggles` (API-ADM-09, S0-T10): the Kawalan Ciri rows in server order, Admin Pusat only
 * (401 without a session, 403 for any other role). Read-only in the mock; the rows are a fixed illustrative set
 * in the contract shape (`FeatureToggle`).
 */

import type { FeatureToggle } from '@pp/contract'

import { ok, requireRole, route, type RouteDef } from '@/mock/define'

const FEATURE_TOGGLES: readonly FeatureToggle[] = [
  { key: 'permainan', labelMs: 'Zona Permainan', audience: 'pelajar', enabled: true, locked: false },
  { key: 'latih-tubi', labelMs: 'Latih Tubi', audience: 'pelajar', enabled: true, locked: false },
  { key: 'cikgu-alesa', labelMs: 'Cikgu Alesa', audience: 'pelajar', enabled: false, locked: true },
  { key: 'guru.kelas', labelMs: 'Kelas', audience: 'guru', enabled: true, locked: false },
]

export const featureToggleRoutes: RouteDef[] = [
  route('GET', '/api/admin/feature-toggles', [requireRole('admin')], () =>
    ok(FEATURE_TOGGLES.map((t) => ({ ...t }))),
  ),
]
