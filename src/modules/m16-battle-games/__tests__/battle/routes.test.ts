/**
 * S1-S5 and the provisional arena (SRS M16 v1.6 §2, FR-M16-03..06): the routes, their headers and
 * tab titles, and the paths that must stay 404 (`/battle/arena` without a uuid, `/battle/riwayat`).
 */

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { buildRoutes } from '@/app/router'

const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })

describe('M16 battle routes', () => {
  const cases = [
    ['/battle', 'Battle Arena', 'Bertanding kuiz 1v1 dengan pelajar lain!'],
    [
      '/battle/arena/9f0c1d2e-1111-4222-8333-444455556666',
      'Battle Arena',
      'Bertanding kuiz 1v1 dengan pelajar lain!',
    ],
    ['/battle/leaderboard', 'Kedudukan Pelajar Battle', 'Siapa pejuang terhebat minggu ini?'],
    ['/battle/ranking-sekolah', 'Papan Kedudukan Sekolah', 'Kedudukan 10,218 sekolah seluruh Malaysia'],
    ['/battle/history', 'Sejarah Battle', 'Rekod pertandingan anda'],
  ] as const

  it.each(cases)('%s has the live header and a session guard', (path, head, sub) => {
    const r = router.resolve(path)
    expect(r.name).not.toBe('core.not-found')
    expect(r.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      title: head,
      header: { title: head, subtitle: sub },
    })
  })

  it('S4 resolves for a numeric id only', () => {
    expect(router.resolve('/battle/ranking-sekolah/8106').name).toBe('battle-school-detail')
    expect(router.resolve('/battle/ranking-sekolah/abc').name).toBe('core.not-found')
  })

  it.each(['/battle/arena', '/battle/riwayat', '/battle/unknown', '/battle/stats'])(
    '%s is the catch-all 404',
    (path) => {
      expect(router.resolve(path).name).toBe('core.not-found')
    },
  )
})
