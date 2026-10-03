/**
 * Link targets of the shared monitoring component (S2-S5; SRS M11 FR-M11-52, BR-M11-27).
 *
 * Live links always point to the `/admin/…` twin. A teacher cannot open that prefix (FR-M17-06), so the
 * rebuild builds every link from the prefix the screen is mounted on (D9: a dead link is broken; the
 * route prefix is a prop so M17 mounts `/admin/monitoring` and the school-admin alias mounts
 * `/admin-sekolah/monitoring`).
 */

export const MONITORING_BASE = '/guru/monitoring'

export interface MonitoringFilterQuery {
  period: string
  state: string
  tahap: string
}

export interface MonitoringPaths {
  overview: string
  school: (schoolId: number) => string
  student: (schoolId: number, userId: number) => string
  teacher: (schoolId: number, userId: number) => string
  /**
   * The M12 page of a pupil who has no answer (`…/kirkpatrick/pelajar/{id}`, FR-M11-58); `null` on the
   * school-admin alias, where Kirkpatrick is not open to the role (M12 rule), so no link is drawn.
   */
  kirkpatrickStudent: (userId: number) => string | null
  exportHref: (format: 'pdf' | 'csv', query: MonitoringFilterQuery) => string
}

export function monitoringPaths(base: string = MONITORING_BASE): MonitoringPaths {
  const root = base.replace(/\/+$/, '')
  const kirkpatrick = root.replace(/\/monitoring$/, '/kirkpatrick')
  return {
    overview: root,
    school: (id) => `${root}/sekolah/${String(id)}`,
    student: (id, uid) => `${root}/sekolah/${String(id)}/pelajar/${String(uid)}`,
    teacher: (id, uid) => `${root}/sekolah/${String(id)}/guru/${String(uid)}`,
    kirkpatrickStudent: (uid) =>
      root.startsWith('/admin-sekolah/') ? null : `${kirkpatrick}/pelajar/${String(uid)}`,
    exportHref: (format, query) => {
      const pairs = (['period', 'state', 'tahap'] as const)
        .filter((k) => query[k] !== '')
        .map((k) => `${k}=${encodeURIComponent(query[k])}`)
      return `${root}/export/${format}?${pairs.join('&')}`
    },
  }
}
