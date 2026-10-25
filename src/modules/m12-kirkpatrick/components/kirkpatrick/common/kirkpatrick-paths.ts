/**
 * Link targets of the shared Kirkpatrick screens (S1-S8; SRS M12 FR-M12-12).
 *
 * Live links always point to the `/admin/kirkpatrick...` twin, which a teacher cannot open (the
 * M17/M01 non-admin rule sends a teacher to the landing page): a dead link, so under D9 the rebuild
 * builds every link from the prefix the screen is mounted on, as M11 does for monitoring (the
 * deviation is recorded in the M12-T2 report). The route prefix is a prop of every page so the
 * `/admin`, `/guru` and `/admin-sekolah` mounts share the components.
 */

import type { EntityId } from '@/api'

export const KIRKPATRICK_ADMIN_BASE = '/admin/kirkpatrick'

export interface KirkpatrickPaths {
  overview: string
  reaction: string
  learning: string
  behavior: string
  results: string
  chain: string
  interventions: string
  /** S8 `.../pelajar/{id}`. */
  pelajar: (userId: EntityId) => string
  /** The monitoring overview of the same mount (`/admin/monitoring`, `/guru/monitoring`, ...). */
  monitoring: string
  /** The monitoring school page of the same mount. */
  monitoringSchool: (schoolId: EntityId) => string
}

/** `/admin/kirkpatrick` -> `/admin/monitoring`; the same replacement for the other mounts. */
export function monitoringBaseOf(base: string): string {
  return base.replace(/\/kirkpatrick$/, '/monitoring')
}

export function kirkpatrickPaths(base: string = KIRKPATRICK_ADMIN_BASE): KirkpatrickPaths {
  const root = base.replace(/\/+$/, '')
  const monitoring = monitoringBaseOf(root)
  return {
    overview: root,
    reaction: `${root}/reaction`,
    learning: `${root}/learning`,
    behavior: `${root}/behavior`,
    results: `${root}/results`,
    chain: `${root}/chain`,
    interventions: `${root}/interventions`,
    pelajar: (id) => `${root}/pelajar/${String(id)}`,
    monitoring,
    monitoringSchool: (id) => `${monitoring}/sekolah/${String(id)}`,
  }
}
