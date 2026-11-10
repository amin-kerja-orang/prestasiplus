// @vitest-environment jsdom
/** `/admin/gamification` "Gamifikasi Overview" against a mocked client (V2 overview.blade.php). */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminOverviewPage from '../../pages/admin/AdminOverviewPage.vue'
import routes from '../../routes/admin'
import { open, overview, TIERS, tid } from './support'

const api = vi.hoisted(() => ({ fetchAdminOverview: vi.fn(), fetchAdminTiers: vi.fn() }))
vi.mock('../../api/admin', () => api)

beforeEach(() => {
  document.body.innerHTML = ''
  api.fetchAdminOverview.mockReset().mockResolvedValue(overview())
  api.fetchAdminTiers.mockReset().mockResolvedValue(TIERS)
})

describe('route', () => {
  it('is /admin/gamification in the admin shell with the V2 title and subtitle', () => {
    expect(routes.find((r) => r.path === '/admin/gamification')?.meta).toMatchObject({
      layout: 'admin',
      roles: ['admin'],
      header: { title: '🎮 Gamifikasi Overview', subtitle: 'Pantau sistem gamifikasi PRESTASIPLUS' },
    })
  })
})

describe('AdminOverviewPage', () => {
  it('shows the six tiles with the V2 labels and the numbers', async () => {
    const { w } = await open(AdminOverviewPage, '/admin/gamification')
    for (const label of [
      'Pelajar Aktif',
      'Syiling Dijana',
      'Token Terkumpul',
      'Penukaran',
      'Cabaran Aktif',
      'Siap Hari Ini',
    ]) {
      expect(w.text()).toContain(label)
    }
    expect(w.text()).toContain('1,932')
  })

  it('lists the tier distribution with icon, label, count and percent, and the pupils without a tier', async () => {
    const { w } = await open(AdminOverviewPage, '/admin/gamification')
    const bronze = tid(w, 'gam-overview-tier-bronze').text()
    expect(bronze).toContain('🥉 Gangsa')
    expect(bronze).toContain('7 · 78%')
    expect(tid(w, 'gam-overview-notier').text()).toBe('1 pelajar belum ditetapkan tier.')
  })

  it('names the tiers from the overview itself when the tier list is empty', async () => {
    api.fetchAdminTiers.mockResolvedValue([])
    const { w } = await open(AdminOverviewPage, '/admin/gamification')
    expect(tid(w, 'gam-overview-tier-silver').text()).toContain('🥈 Perak')
    expect(tid(w, 'gam-overview-top-1').text()).toContain('🥉 Gangsa · Level 1')
  })

  it('tints each tier bar by a design-system tone from the tier colour', async () => {
    const { w } = await open(AdminOverviewPage, '/admin/gamification')
    expect(tid(w, 'gam-overview-tier-bronze').attributes('data-tone')).toBe('warning')
    expect(tid(w, 'gam-overview-tier-silver').attributes('data-tone')).toBe('primary')
  })

  it('lists the top pupils with rank, tier, level and syiling', async () => {
    const { w } = await open(AdminOverviewPage, '/admin/gamification')
    const first = tid(w, 'gam-overview-top-1').text()
    expect(first).toContain('Murid Demo')
    expect(first).toContain('🥉 Gangsa · Level 1')
    expect(first).toContain('1,386 syiling')
    expect(w.text()).toContain('Top 10 Pelajar')
  })

  it('shows the recent transactions with a signed amount and a link to the full ledger', async () => {
    const { w } = await open(AdminOverviewPage, '/admin/gamification')
    const panel = tid(w, 'gam-overview-recent')
    expect(panel.text()).toContain('Transaksi Terkini')
    expect(panel.text()).toContain('+10')
    expect(panel.text()).toContain('-5')
    const link = panel.find('a[href="/admin/gamification/transactions"]')
    expect(link.exists()).toBe(true)
    expect(link.text()).toContain('Lihat semua')
  })

  it('shows the V2 empty copy for each empty region', async () => {
    api.fetchAdminOverview.mockResolvedValue(overview({ tierDistribution: [], top10: [], recent: [] }))
    const { w } = await open(AdminOverviewPage, '/admin/gamification')
    expect(w.text()).toContain('Tiada tier dikonfigurasi.')
    expect(w.text()).toContain('Tiada data pelajar.')
    expect(w.text()).toContain('Tiada transaksi lagi.')
  })

  it('shows one error with a retry that fetches again', async () => {
    api.fetchAdminOverview.mockRejectedValueOnce(new Error('x'))
    const { w } = await open(AdminOverviewPage, '/admin/gamification')
    const error = tid(w, 'gam-overview-error')
    expect(error.text()).toContain('Tidak dapat memuatkan data. Sila cuba semula.')
    await error.find('button').trigger('click')
    await vi.waitFor(() => expect(api.fetchAdminOverview).toHaveBeenCalledTimes(2))
  })
})
