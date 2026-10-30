// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'

import type { RenewalInvoice } from '../../api/subscriptions'
import RenewalInvoicePage from '../../pages/RenewalInvoicePage.vue'

const api = vi.hoisted(() => ({ fetchRenewalInvoice: vi.fn() }))
vi.mock('../../api/subscriptions', () => api)

function invoice(): RenewalInvoice {
  return {
    ref: 'INV-10-20260925',
    date: '2026-09-25T15:40:00+08:00',
    school: {
      id: 8106,
      name: 'SEKOLAH CONTOH',
      code: 'BEA4632',
      type: 'SMK',
      state: 'Selangor',
      district: 'PPD CONTOH',
      city: null,
    },
    packageName: 'Pakej SPM Tingkatan 5',
    currentPeriod: { start: '2026-04-21T09:00:00+08:00', end: '2027-05-08T09:00:00+08:00' },
    renewalPeriod: { start: '2027-05-08T09:00:00+08:00', end: '2028-05-08T09:00:00+08:00' },
    students: [
      { no: 1, name: 'Pelajar Satu', idDelima: 'm-1@moe-dl.edu.my', classLevel: 'T5' },
      { no: 2, name: 'Pelajar Dua', idDelima: 'm-2@moe-dl.edu.my', classLevel: 'T5' },
    ],
    studentCount: 562,
    pricePerStudent: '30.00',
    total: '16860.00',
  }
}

let wrapper: VueWrapper | null = null

async function render() {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: RenewalInvoicePage },
      {
        path: '/admin/school-subscriptions/:id',
        name: 'm02.subscriptions.detail',
        component: stub,
      },
    ],
  })
  await router.push('/')
  wrapper = mount(RenewalInvoicePage, { props: { id: 10 }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchRenewalInvoice.mockReset()
  api.fetchRenewalInvoice.mockResolvedValue(invoice())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
  setRouteOutcome(null)
})

describe('RenewalInvoicePage (M02 S15)', () => {
  it('shows the header, date, ref, school, package and periods', async () => {
    const w = await render()
    expect(w.get('h1').text()).toBe('PRESTASIPLUS')
    expect(w.text()).toContain('Platform Pembelajaran Interaktif')
    expect(w.text()).toContain('https://prestasiplus.my')
    expect(w.get('h2').text()).toBe('Invoice Pembaharuan')
    expect(w.get('[data-testid=invoice-date]').text()).toBe('Tarikh: 25/09/2026')
    expect(w.get('[data-testid=invoice-ref]').text()).toBe('Ref: INV-10-20260925')
    expect(w.get('[data-testid=invoice-school]').text()).toBe('SEKOLAH CONTOH')
    expect(w.get('[data-testid=invoice-school-meta]').text()).toBe(
      'Kod: BEA4632 · Selangor · PPD CONTOH',
    )
    expect(w.get('[data-testid=invoice-package]').text()).toBe('Pakej SPM Tingkatan 5')
    expect(w.get('[data-testid=invoice-current]').text()).toBe('21/04/2026 - 08/05/2027')
    expect(w.get('[data-testid=invoice-renewal]').text()).toBe('08/05/2027 - 08/05/2028')
  })

  it('lists the students and shows the totals from the enrolled count', async () => {
    const w = await render()
    expect(w.get('[data-testid=invoice-list-title]').text()).toBe('Senarai Pelajar (562 orang)')
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      'No.',
      'Nama Pelajar',
      'ID Delima',
      'Tingkatan',
    ])
    expect(w.findAll('[data-testid=invoice-row]')).toHaveLength(2)
    expect(w.get('[data-testid=invoice-count]').text()).toBe('562 orang')
    expect(w.get('[data-testid=invoice-price]').text()).toBe('RM30.00')
    expect(w.get('[data-testid=invoice-total]').text()).toBe('RM16,860.00')
    expect(w.text()).toContain('Dokumen ini dijana secara automatik oleh sistem PRESTASIPLUS.')
  })

  it('"Cetak Invoice" calls window.print; the toolbar is print-hidden; "Kembali" goes to S14', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const w = await render()
    await w.get('[data-testid=invoice-print]').trigger('click')
    expect(print).toHaveBeenCalledTimes(1)
    expect(w.get('[data-testid=invoice-toolbar]').classes()).toContain('print:hidden')
    expect(w.get('[data-testid=invoice-back]').attributes('href')).toBe(
      '/admin/school-subscriptions/10',
    )
    vi.unstubAllGlobals()
  })

  it('prints: the invoice is inside the print sheet and the print bar is not', async () => {
    const w = await render()
    const sheet = w.get('[data-ds="print-sheet"]')
    expect(sheet.find('h1').exists()).toBe(true)
    expect(sheet.find('[data-testid=invoice-table]').exists()).toBe(true)
    expect(sheet.find('[data-testid=invoice-totals]').exists()).toBe(true)
    expect(sheet.find('[data-testid=invoice-total]').text()).toBe('RM16,860.00')
    expect(sheet.find('[data-testid=invoice-toolbar]').exists()).toBe(false)
    expect(sheet.find('[data-testid=invoice-print]').exists()).toBe(false)
    expect(
      w.get('[data-testid=invoice-toolbar]').element.closest('[data-ds="print-sheet"]'),
    ).toBeNull()
  })

  it('renders the standard 404 outcome, without a red box, for an unknown id', async () => {
    api.fetchRenewalInvoice.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    const w = await render()
    expect(w.find('[data-testid=invoice-error]').exists()).toBe(false)
    expect(useRouteOutcome().value).toBe(404)
  })

  it('shows the red box with a retry for another load failure', async () => {
    api.fetchRenewalInvoice.mockRejectedValueOnce(new Error('boom'))
    const w = await render()
    expect(w.find('[data-testid=invoice-error]').exists()).toBe(true)
    expect(useRouteOutcome().value).toBeNull()
  })
})
