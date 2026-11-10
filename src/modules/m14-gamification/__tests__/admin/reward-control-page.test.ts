// @vitest-environment jsdom
/** `/admin/reward-control` "Kawalan Reward", read only (V2 reward-control.blade.php). */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminRewardControlPage from '../../pages/admin/AdminRewardControlPage.vue'
import routes from '../../routes/admin'
import { open, rewardControl, tid } from './support'

const api = vi.hoisted(() => ({ fetchRewardControl: vi.fn() }))
vi.mock('../../api/admin', () => api)

beforeEach(() => {
  document.body.innerHTML = ''
  api.fetchRewardControl.mockReset().mockResolvedValue(rewardControl())
})

describe('AdminRewardControlPage', () => {
  it('has the V2 title and subtitle on its route', () => {
    expect(routes.find((r) => r.path === '/admin/reward-control')?.meta).toMatchObject({
      header: { title: '🛡️ Kawalan Reward', subtitle: 'Kawalan kewangan ekonomi ganjaran' },
    })
  })

  it('shows the liability tile in RM and the two counts', async () => {
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    const text = w.text()
    expect(text).toContain('Liabiliti sesi 2026')
    expect(text).toContain('RM1,234.50')
    expect(text).toContain('jumlah kos hadiah ditebus')
    expect(text).toContain('Pelajar Menebus')
    expect(text).toContain('Jumlah Tebusan')
  })

  it('shows Tetapan Kewangan with the budget in RM and the games answer', async () => {
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    const text = tid(w, 'gam-reward-settings').text()
    expect(text).toContain('⚙️ Tetapan Kewangan')
    expect(text).toContain('Bajet tebus / sesi')
    expect(text).toContain('RM300.00')
    expect(text).toContain('Tahun sesi semasa')
    expect(text).toContain('Tidak (XP sahaja)')
    const on = rewardControl()
    on.settings.gamesAwardSyiling = 1
    api.fetchRewardControl.mockResolvedValue(on)
    const again = await open(AdminRewardControlPage, '/admin/reward-control')
    expect(tid(again.w, 'gam-reward-settings').text()).toContain('Ya')
  })

  it('shows the gift cost table', async () => {
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    const text = tid(w, 'gam-reward-gifts').text()
    expect(text).toContain('🎁 Kos Sebenar Hadiah — digital = RM0, tidak makan bajet')
    expect(text).toContain('Baucar Buku RM10')
    expect(text).toContain('ECOMMERCE')
    expect(text).toContain('RM10.00')
    expect(text).toContain('RM0.00')
  })

  it('has the V2 gift columns: Hadiah, Kategori, Harga Token, Kos Sebenar, Status', async () => {
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    const head = tid(w, 'gam-reward-gifts')
      .findAll('th')
      .map((th) => th.text())
    expect(head).toEqual(['Hadiah', 'Kategori', 'Harga Token', 'Kos Sebenar', 'Status'])
  })

  it('shows the token price and the status of each gift', async () => {
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    const rows = tid(w, 'gam-reward-gifts')
      .findAll('tbody tr')
      .map((tr) => tr.findAll('td').map((td) => td.text()))
    expect(rows[0]).toEqual(['Baucar Buku RM10', 'ECOMMERCE', '120', 'RM10.00', 'Aktif'])
    expect(rows[1]).toEqual(['Lencana Eksklusif', 'GAMING', '0', 'RM0.00', 'Nyahaktif'])
  })

  it('falls back to the syiling catalogue with a dash for the token price when the endpoint sends no gifts', async () => {
    const without = rewardControl()
    delete without.gifts
    api.fetchRewardControl.mockResolvedValue(without)
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    const rows = tid(w, 'gam-reward-gifts')
      .findAll('tbody tr')
      .map((tr) => tr.findAll('td').map((td) => td.text()))
    expect(rows[0]).toEqual(['Baucar Buku RM10', 'VOUCHER', '—', 'RM10.00', 'Aktif'])
  })

  it('shows the lucky draws with the winners', async () => {
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    const text = tid(w, 'gam-reward-draws').text()
    expect(text).toContain('🎟️ Cabutan Bertuah')
    expect(text).toContain('#1')
    expect(text).toContain('Cabutan Demo')
    expect(text).toContain('Open')
    expect(text).toContain('Murid Demo')
  })

  it('shows the V2 empty copy for gifts and draws', async () => {
    api.fetchRewardControl.mockResolvedValue(rewardControl({ rewards: [], gifts: [], draws: [] }))
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    expect(w.text()).toContain('Tiada hadiah dalam katalog.')
    expect(w.text()).toContain('Tiada cabutan lagi.')
  })

  it('is read only: no input and no save button', async () => {
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    expect(w.find('input').exists()).toBe(false)
    expect(w.find('button').exists()).toBe(false)
  })

  it('shows an error with retry', async () => {
    api.fetchRewardControl.mockRejectedValueOnce(new Error('x'))
    const { w } = await open(AdminRewardControlPage, '/admin/reward-control')
    expect(tid(w, 'gam-reward-control-error').exists()).toBe(true)
  })
})
