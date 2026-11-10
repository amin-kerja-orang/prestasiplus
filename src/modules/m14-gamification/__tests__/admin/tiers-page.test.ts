// @vitest-environment jsdom
/** `/admin/gamification/tiers` "Tier Configuration", read only (V2 tiers.blade.php, D118-3). */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminTiersPage from '../../pages/admin/AdminTiersPage.vue'
import routes from '../../routes/admin'
import { open, overview, TIERS, tid } from './support'

const api = vi.hoisted(() => ({ fetchAdminTiers: vi.fn(), fetchAdminOverview: vi.fn() }))
vi.mock('../../api/admin', () => api)

beforeEach(() => {
  document.body.innerHTML = ''
  api.fetchAdminTiers.mockReset().mockResolvedValue(TIERS)
  api.fetchAdminOverview.mockReset().mockResolvedValue(overview())
})

describe('AdminTiersPage', () => {
  it('has the V2 title and subtitle on its route', () => {
    expect(routes.find((r) => r.path === '/admin/gamification/tiers')?.meta).toMatchObject({
      header: {
        title: '👑 Tier Configuration',
        subtitle: 'Urus tier sistem gamifikasi — termasuk ganjaran Syiling per soalan',
      },
    })
  })

  it('says it is read only and offers no editing control', async () => {
    const { w } = await open(AdminTiersPage, '/admin/gamification/tiers')
    expect(tid(w, 'gam-tiers-note').text()).toContain('Paparan konfigurasi tier (baca sahaja).')
    expect(w.find('input').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
  })

  it('shows order, pupils, min syiling, rate and the three reward blocks per tier', async () => {
    const { w } = await open(AdminTiersPage, '/admin/gamification/tiers')
    const bronze = tid(w, 'gam-tier-bronze').text()
    expect(bronze).toContain('🥉 Gangsa')
    expect(bronze).toContain('Urutan #1 · 7 pelajar')
    expect(bronze).toContain('Min Syiling')
    expect(bronze).toContain('Kadar Tukar')
    expect(tid(w, 'gam-tier-bronze-quiz').text()).toContain('📝 Latih Tubi — Syiling / Betul')
    expect(tid(w, 'gam-tier-bronze-pksk').text()).toContain('Semua soalan PKSK (tiada level)')
    expect(tid(w, 'gam-tier-bronze-board').text()).toContain('Menang')
    expect(tid(w, 'gam-tier-bronze-perks').text()).toContain('Akses asas hadiah · Profil asas')
    expect(tid(w, 'gam-tier-silver-perks').exists()).toBe(false)
  })

  it('shows the V2 empty copy when there is no tier', async () => {
    api.fetchAdminTiers.mockResolvedValue([])
    const { w } = await open(AdminTiersPage, '/admin/gamification/tiers')
    expect(tid(w, 'gam-tiers-empty').text()).toContain('Tiada tier dikonfigurasi lagi.')
  })

  it('shows an error with retry', async () => {
    api.fetchAdminTiers.mockRejectedValueOnce(new Error('x'))
    const { w } = await open(AdminTiersPage, '/admin/gamification/tiers')
    expect(tid(w, 'gam-tiers-error').exists()).toBe(true)
  })
})
