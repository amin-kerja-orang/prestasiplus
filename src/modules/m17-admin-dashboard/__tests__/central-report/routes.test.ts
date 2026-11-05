/**
 * R1-ADM-M-07 (S6-T13): the central view routes sit behind `VITE_CENTRAL_REPORTS`. Off (default): no route is
 * registered (the global 404). On: 8 records `/admin/laporan-sekolah/{view}` for the admin only (PM-24 Headcount waits).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const load = async () => (await import('../../routes/laporan')).default
const loadAll = async () => (await import('../../routes')).default

describe('central report routes', () => {
  it('registers none while the flag is off (default)', async () => {
    expect(await load()).toEqual([])
    expect((await loadAll()).filter((r) => r.path.startsWith('/admin/laporan-sekolah'))).toEqual([])
  })

  it('registers none for any value but "on"', async () => {
    vi.stubEnv('VITE_CENTRAL_REPORTS', 'off')
    expect(await load()).toEqual([])
  })

  it('registers the eight views for the admin only when the flag is on', async () => {
    vi.stubEnv('VITE_CENTRAL_REPORTS', 'on')
    vi.resetModules()
    const routes = await load()
    expect(routes.map((r) => r.path)).toEqual([
      '/admin/laporan-sekolah/laporan-aktiviti',
      '/admin/laporan-sekolah/amaran-wellbeing',
      '/admin/laporan-sekolah/statistik-penggunaan',
      '/admin/laporan-sekolah/dskp-heatmap',
      '/admin/laporan-sekolah/amaran-awal',
      '/admin/laporan-sekolah/laporan-bulanan',
      '/admin/laporan-sekolah/analisa-item',
      '/admin/laporan-sekolah/sekolah-bersaing',
    ])
    for (const r of routes) {
      expect(r.meta).toMatchObject({ roles: ['admin'], access: 'auth', layout: 'admin', module: 'M17' })
    }
    const withView = routes.filter((r) => r.props !== undefined)
    expect(withView).toHaveLength(7)
    for (const r of withView) {
      expect((r.props as { view: string }).view).toBe(String(r.path).split('/').pop())
    }
    // PM-28: the national board has no picker, so its record redirects to the existing page
    const board = routes.find((r) => r.path === '/admin/laporan-sekolah/sekolah-bersaing')
    expect(board?.redirect).toBe('/sekolah-bersaing')
    expect(board?.component).toBeUndefined()
    expect(new Set(routes.map((r) => r.name)).size).toBe(8)
  })
})
