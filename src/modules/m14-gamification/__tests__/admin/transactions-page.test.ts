// @vitest-environment jsdom
/** `/admin/gamification/transactions` "Transaksi Syiling" (V2 transactions.blade.php). */
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminTransactionsPage from '../../pages/admin/AdminTransactionsPage.vue'
import routes from '../../routes/admin'
import { listOf, open, tid, txnRow } from './support'

const api = vi.hoisted(() => ({ fetchAdminTransactions: vi.fn() }))
vi.mock('../../api/admin', () => api)

beforeEach(() => {
  document.body.innerHTML = ''
  api.fetchAdminTransactions
    .mockReset()
    .mockResolvedValue(
      listOf([txnRow(), txnRow({ id: '67', type: 'spend', amount: -250, description: '' })], { pageSize: 25 }),
    )
})

describe('AdminTransactionsPage', () => {
  it('has the V2 title and subtitle on its route', () => {
    expect(routes.find((r) => r.path === '/admin/gamification/transactions')?.meta).toMatchObject({
      header: { title: '📋 Transaksi Syiling', subtitle: 'Log semua transaksi syiling dalam sistem' },
    })
  })

  it('shows the six type chips with the V2 words', async () => {
    const { w } = await open(AdminTransactionsPage, '/admin/gamification/transactions')
    const nav = w.get('nav[aria-label="Jenis transaksi"]')
    for (const label of ['Semua Jenis', '💰 Dapat', '🛍️ Belanja', '🔄 Tukar', '🎁 Bonus', '↩️ Refund']) {
      expect(nav.text()).toContain(label)
    }
  })

  it('shows the V2 columns, signed amounts, the date as dd/mm/yyyy HH:MM and a dash for no description', async () => {
    const { w } = await open(AdminTransactionsPage, '/admin/gamification/transactions')
    expect(w.findAll('th').map((th) => th.text())).toEqual([
      'ID',
      'Pelajar',
      'Jenis',
      'Jumlah',
      'Baki Selepas',
      'Sumber',
      'Keterangan',
      'Tarikh',
    ])
    const text = tid(w, 'gam-transactions-table').text()
    expect(text).toContain('#68')
    expect(text).toContain('+2')
    expect(text).toContain('-250')
    expect(text).toContain('1,004')
    expect(text).toContain('10/11/2026 08:39')
    expect(text).toContain('—')
  })

  it('fetches with no type first, then with the chosen type, which goes into the URL', async () => {
    const { w, router } = await open(AdminTransactionsPage, '/admin/gamification/transactions')
    expect(api.fetchAdminTransactions).toHaveBeenCalledWith(expect.objectContaining({ type: '', page: 1 }))
    await tid(w, 'gam-transactions-pill-spend').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ type: 'spend' })
    expect(api.fetchAdminTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'spend' }))
  })

  it('opens on the type of the query string and ignores an unknown one', async () => {
    await open(AdminTransactionsPage, '/admin/gamification/transactions?type=bonus')
    expect(api.fetchAdminTransactions).toHaveBeenCalledWith(expect.objectContaining({ type: 'bonus' }))
    api.fetchAdminTransactions.mockClear()
    await open(AdminTransactionsPage, '/admin/gamification/transactions?type=nonsense')
    expect(api.fetchAdminTransactions).toHaveBeenCalledWith(expect.objectContaining({ type: '' }))
  })

  it('shows the V2 empty copy, with and without a type', async () => {
    api.fetchAdminTransactions.mockResolvedValue(listOf([], { pageSize: 25 }))
    const { w } = await open(AdminTransactionsPage, '/admin/gamification/transactions')
    expect(w.text()).toContain('Tiada transaksi dalam log.')
    const typed = await open(AdminTransactionsPage, '/admin/gamification/transactions?type=refund')
    expect(typed.w.text()).toContain('Tiada transaksi dalam log untuk jenis ini.')
  })
})
