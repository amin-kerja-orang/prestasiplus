// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { useFlashStore } from '@/stores/flash'

import type { SubscriptionDetail } from '../../api/subscriptions'
import SubscriptionDetailPage from '../../pages/SubscriptionDetailPage.vue'

const api = vi.hoisted(() => ({
  fetchSubscription: vi.fn(),
  fetchSubscriptionStudents: vi.fn(),
  updateSubscriptionQuota: vi.fn(),
  extendSubscription: vi.fn(),
  upgradeSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  SUBSCRIPTION_PER_PAGE_OPTIONS: [25, 50, 100, 200],
}))
vi.mock('../../api/subscriptions', () => api)

function detail(extra: Partial<SubscriptionDetail> = {}): SubscriptionDetail {
  return {
    id: 14,
    schoolId: 8277,
    schoolPackageId: 2,
    packageTier: 'basic',
    studentQuota: 1000,
    used: 150,
    status: 'active',
    startsAt: '2026-05-12T03:53:00+08:00',
    endsAt: '2027-05-12T03:53:00+08:00',
    questionLimit: 500,
    paymentReference: null,
    paymentNotes: null,
    notes: 'Baris satu\nBaris dua',
    createdAt: '2026-05-12T03:53:00+08:00',
    updatedAt: '2026-05-12T03:53:00+08:00',
    formLevel: 't5',
    remaining: 850,
    usedPercent: 15,
    school: {
      id: 8277,
      name: 'SEKOLAH CONTOH',
      code: 'BFT4001',
      type: 'SAM',
      state: 'Selangor',
      district: 'PPD CONTOH',
      city: null,
    },
    package: {
      id: 2,
      code: 'T5',
      name: 'Pakej SPM Tingkatan 5',
      slug: 'spm-t5',
      educationLevel: 'spm',
      formLevel: 't5',
      priceAnnual: '30.00',
      maxRenewals: 0,
      isActive: true,
    },
    ...extra,
  }
}

function students(total = 150, pageSize = 50) {
  const data = Array.from({ length: Math.min(total, pageSize) }, (_, i) => ({
    id: i + 1,
    name: `Pelajar ${String(i + 1)}`,
    idDelima: `m-${String(i)}@moe-dl.edu.my`,
    classLevel: 'T5',
  }))
  return {
    data,
    meta: {
      page: 1,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
      from: 1,
      to: data.length,
    },
  }
}

let wrapper: VueWrapper | null = null

async function render(url = '/admin/school-subscriptions/14') {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/school-subscriptions', component: stub },
      {
        path: '/admin/school-subscriptions/:id',
        name: 'm02.subscriptions.detail',
        component: SubscriptionDetailPage,
        props: (r) => ({ id: Number(r.params.id) }),
      },
      {
        path: '/admin/school-subscriptions/:id/renewal-invoice',
        name: 'm02.subscriptions.invoice',
        component: stub,
      },
    ],
  })
  await router.push(url)
  wrapper = mount(SubscriptionDetailPage, { props: { id: 14 }, global: { plugins: [router] } })
  await flushPromises()
  return { w: wrapper, router }
}

const mutation = (extra: Partial<SubscriptionDetail> = {}, status = 'OK') => ({
  data: detail(extra),
  status,
})

beforeEach(() => {
  // Pinned clock; every date is formatted in MYT by the shared helpers, whatever the runner zone.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-25T15:40:00+08:00'))
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) {
    if (typeof fn === 'function') (fn as ReturnType<typeof vi.fn>).mockReset()
  }
  api.fetchSubscription.mockResolvedValue(detail())
  api.fetchSubscriptionStudents.mockResolvedValue(students())
})

afterEach(() => {
  vi.useRealTimers()
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('SubscriptionDetailPage (M02 S14)', () => {
  it('shows the summary, usage, the basic box, tiles and the multi-line note', async () => {
    const { w } = await render()
    expect(w.get('[data-testid=sub-school]').text()).toBe('SEKOLAH CONTOH')
    expect(w.get('[data-testid=sub-code]').text()).toBe('BFT4001 · Pakej SPM Tingkatan 5')
    expect(w.get('[data-testid=sub-usage]').text()).toBe('150 / 1000')
    expect(w.get('[data-testid=sub-bar]').classes()).toContain('bg-emerald-500')
    expect(w.get('[data-testid=sub-percent]').text()).toBe('15% digunakan')
    expect(w.get('[data-testid=sub-remaining]').text()).toBe('Baki: 850 pelajar')
    expect(w.get('[data-testid=sub-basic-box]').text()).toContain(
      '500 soalan/bulan/pelajar · PERCUMA · Tamat 12/05/2027',
    )
    expect(w.get('[data-testid=sub-tiles]').text()).toContain('500/bulan')
    expect(w.get('[data-testid=sub-notes] span').classes()).toContain('whitespace-pre-line')
    expect(w.get('[data-testid=sub-notes]').text()).toContain('Nota:')
  })

  it('shows a red full bar and price tiles for a full subscription, without the upgrade button', async () => {
    api.fetchSubscription.mockResolvedValue(
      detail({
        packageTier: 'full',
        used: 562,
        studentQuota: 500,
        usedPercent: 100,
        remaining: 0,
        questionLimit: null,
      }),
    )
    const { w } = await render()
    expect(w.get('[data-testid=sub-bar]').classes()).toContain('bg-red-500')
    expect(w.get('[data-testid=sub-usage]').text()).toBe('562 / 500')
    expect(w.get('[data-testid=sub-price]').text()).toBe('RM30.00')
    expect(w.get('[data-testid=sub-total]').text()).toBe('RM15,000.00')
    expect(w.find('[data-testid=sub-toggle-upgrade]').exists()).toBe(false)
  })

  it('lists students with "Tunjuk" showing the page size actually used', async () => {
    const { w } = await render()
    expect(w.findAll('[data-testid=sub-student-row]')).toHaveLength(50)
    expect((w.get('[data-testid=sub-per-page]').element as HTMLSelectElement).value).toBe('50')
    expect(w.get('[data-testid=sub-range]').text()).toBe('perbarisan · Memaparkan 1-50 dari 150')
  })

  it('navigates to ?per_page= on a page-size change', async () => {
    const { w, router } = await render()
    await w.get('[data-testid=sub-per-page]').setValue('25')
    await flushPromises()
    expect(router.currentRoute.value.query.per_page).toBe('25')
  })

  it('toggles the three panels independently', async () => {
    const { w } = await render()
    await w.get('[data-testid=sub-toggle-quota]').trigger('click')
    await w.get('[data-testid=sub-toggle-extend]').trigger('click')
    await w.get('[data-testid=sub-toggle-upgrade]').trigger('click')
    expect(w.find('[data-testid=sub-quota-form]').exists()).toBe(true)
    expect(w.find('[data-testid=sub-extend-form]').exists()).toBe(true)
    expect(w.get('[data-testid=sub-upgrade-text]').text()).toContain(
      'Naik taraf dari Pemantauan (500 soalan/bulan) ke Penuh (Tanpa Had). Langganan akan dilanjutkan 1 tahun dari sekarang dengan harga RM30.00/pelajar.',
    )
    expect((w.get('[data-testid=sub-quota-input]').element as HTMLInputElement).value).toBe('1000')
    expect(w.get('[data-testid=sub-extend-current]').text()).toContain(
      'Tamat semasa: 12/05/2027 03:53',
    )
    await w.get('[data-testid=sub-toggle-quota]').trigger('click')
    expect(w.find('[data-testid=sub-quota-form]').exists()).toBe(false)
    expect(w.find('[data-testid=sub-extend-form]').exists()).toBe(true)
  })

  it('fills the days from the presets', async () => {
    const { w } = await render()
    await w.get('[data-testid=sub-toggle-extend]').trigger('click')
    const presets = w.findAll('[data-testid=sub-extend-preset]')
    expect(presets.map((p) => p.text())).toEqual([
      '7 Hari',
      '14 Hari',
      '1 Bulan',
      '2 Bulan',
      '3 Bulan',
      '6 Bulan',
      '1 Tahun',
    ])
    await presets[2]!.trigger('click')
    expect((w.get('[data-testid=sub-extend-days]').element as HTMLInputElement).value).toBe('30')
    expect(w.get('[data-testid=sub-extend-days]').attributes('max')).toBe('365')
  })

  it('saves a new quota and shows the flash', async () => {
    api.updateSubscriptionQuota.mockResolvedValue(
      mutation({ studentQuota: 1200, usedPercent: 13 }, 'Kuota berjaya dikemaskini.'),
    )
    const { w } = await render()
    await w.get('[data-testid=sub-toggle-quota]').trigger('click')
    await w.get('[data-testid=sub-quota-input]').setValue(1200)
    await w.get('[data-testid=sub-quota-notes]').setValue('Tambah')
    await w.get('[data-testid=sub-quota-form]').trigger('submit')
    await flushPromises()
    expect(api.updateSubscriptionQuota).toHaveBeenCalledWith(14, {
      studentQuota: 1200,
      notes: 'Tambah',
    })
    expect(w.get('[data-testid=sub-usage]').text()).toBe('150 / 1200')
    expect(useFlashStore().current?.message).toBe('Kuota berjaya dikemaskini.')
  })

  it('sends nothing when a confirm is dismissed, and acts when accepted', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    api.cancelSubscription.mockResolvedValue(
      mutation({ status: 'cancelled' }, 'Langganan berjaya dibatalkan.'),
    )
    api.upgradeSubscription.mockResolvedValue(mutation({ packageTier: 'full' }))
    api.extendSubscription.mockResolvedValue(mutation())
    const { w } = await render()

    await w.get('[data-testid=sub-cancel]').trigger('click')
    expect(confirm).toHaveBeenLastCalledWith('Adakah anda pasti mahu batalkan langganan ini?')
    expect(api.cancelSubscription).not.toHaveBeenCalled()

    await w.get('[data-testid=sub-toggle-upgrade]').trigger('click')
    await w.get('[data-testid=sub-upgrade-form]').trigger('submit')
    expect(confirm).toHaveBeenLastCalledWith(
      'Naik taraf ke Pakej Penuh? Ini akan menukar langganan ke tanpa had soalan.',
    )
    expect(api.upgradeSubscription).not.toHaveBeenCalled()

    await w.get('[data-testid=sub-toggle-extend]').trigger('click')
    await w.get('[data-testid=sub-extend-days]').setValue(30)
    await w.get('[data-testid=sub-extend-form]').trigger('submit')
    expect(confirm).toHaveBeenLastCalledWith('Lanjutkan tempoh langganan?')
    expect(api.extendSubscription).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await w.get('[data-testid=sub-cancel]').trigger('click')
    await flushPromises()
    expect(api.cancelSubscription).toHaveBeenCalledWith(14)
    expect(w.get('[data-testid=sub-status]').text()).toBe('Batal')
  })

  it('shows an error box when the subscription cannot load', async () => {
    api.fetchSubscription.mockRejectedValue(new Error('x'))
    const { w } = await render()
    expect(w.find('[data-testid=sub-load-error]').exists()).toBe(true)
  })

  it('renders the standard 404 outcome (no red box) for an unknown id', async () => {
    api.fetchSubscription.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    const { w } = await render()
    expect(w.find('[data-testid=sub-load-error]').exists()).toBe(false)
    expect(useRouteOutcome().value).toBe(404)
    setRouteOutcome(null)
  })
})
