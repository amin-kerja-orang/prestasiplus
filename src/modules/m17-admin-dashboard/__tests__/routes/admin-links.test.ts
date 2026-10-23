/**
 * SWEEP-23OCT D4: every `/admin/monitoring...` link built by M12 and M11 resolves to a registered
 * M17 route; the admin Command Center S3 draws no link to the unbuilt S8 `/admin/laporan-eksekutif`.
 */

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { boardPaths } from '../../components/command-center-board/board-copy'
import routes from '../../routes'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [...routes, { path: '/:pathMatch(.*)*', name: 'nf', component: { template: '<i/>' } }],
})
const resolvesTo = (path: string) => router.resolve(path).matched[0]?.name

describe('M17 /admin/monitoring mount', () => {
  it('registers the four monitoring screens for the admin only', () => {
    const mounted = routes.filter((r) => r.path.startsWith('/admin/monitoring'))
    expect(mounted.map((r) => r.path)).toEqual([
      '/admin/monitoring',
      '/admin/monitoring/sekolah/:schoolId(\\d+)',
      '/admin/monitoring/sekolah/:schoolId(\\d+)/pelajar/:userId(\\d+)',
      '/admin/monitoring/sekolah/:schoolId(\\d+)/guru/:userId(\\d+)',
    ])
    for (const r of mounted) expect(r.meta?.roles).toEqual(['admin'])
  })

  it('every link built by M12 (admin mount) resolves to a registered route', () => {
    // Strings built by `kirkpatrickPaths('/admin/kirkpatrick')`: monitoring, monitoringSchool(8080).
    expect(resolvesTo('/admin/monitoring')).toBe('admin-monitoring')
    expect(resolvesTo('/admin/monitoring/sekolah/8080')).toBe('admin-monitoring-sekolah')
  })

  it('every link built by M11 (admin mount) resolves to a registered route', () => {
    // Strings built by `monitoringPaths('/admin/monitoring')`: overview, school, student, teacher.
    expect(resolvesTo('/admin/monitoring')).toBe('admin-monitoring')
    expect(resolvesTo('/admin/monitoring/sekolah/1')).toBe('admin-monitoring-sekolah')
    expect(resolvesTo('/admin/monitoring/sekolah/1/pelajar/2')).toBe('admin-monitoring-pelajar')
    expect(resolvesTo('/admin/monitoring/sekolah/1/guru/2')).toBe('admin-monitoring-guru')
  })
})

describe('M17 S3 "Laporan Eksekutif" link', () => {
  it('is not drawn while S8 is not built (no route behind it)', () => {
    expect(routes.some((r) => r.path.startsWith('/admin/laporan-eksekutif'))).toBe(false)
    expect(boardPaths(false).report).toBeNull()
  })
})
