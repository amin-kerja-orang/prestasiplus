// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import type { SchoolPackage } from '../../api/subscriptions'
import { searchSchools } from '../../api/schools'
import SubscriptionCreatePage from '../../pages/SubscriptionCreatePage.vue'
import { expectOneColumnBelowMd } from './form-columns'
import { expectListInFlow } from './in-flow'

const api = vi.hoisted(() => ({ fetchSchoolPackages: vi.fn(), createSubscription: vi.fn() }))
vi.mock('../../api/subscriptions', () => api)
vi.mock('../../api/schools', () => ({ searchSchools: vi.fn().mockResolvedValue([]) }))

function pkg(id: number, code: SchoolPackage['code'], maxRenewals: number): SchoolPackage {
  return {
    id,
    code,
    name: `Pakej ${code}`,
    slug: code.toLowerCase(),
    educationLevel: 'spm',
    formLevel: code.toLowerCase() as SchoolPackage['formLevel'],
    priceAnnual: '30.00',
    maxRenewals,
    isActive: true,
  }
}

let wrapper: VueWrapper | null = null

async function render() {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: SubscriptionCreatePage },
      { path: '/admin/school-subscriptions', component: stub },
      {
        path: '/admin/school-subscriptions/:id',
        name: 'm02.subscriptions.detail',
        component: stub,
      },
    ],
  })
  await router.push('/')
  wrapper = mount(SubscriptionCreatePage, { global: { plugins: [router] } })
  await flushPromises()
  return { w: wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchSchoolPackages.mockReset()
  api.createSubscription.mockReset()
  api.fetchSchoolPackages.mockResolvedValue([pkg(1, 'T4', 1), pkg(2, 'T5', 0), pkg(3, 'D1_D6', 5)])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('SubscriptionCreatePage (M02 S13)', () => {
  it('defaults to Pemantauan, no package, quota 100, and shows the basic summary', async () => {
    const { w } = await render()
    expect(w.get('button[role=radio][value=basic]').attributes('aria-checked')).toBe('true')
    expect(w.findAll('[data-testid=sub-packages] button[role=radio]')).toHaveLength(3)
    expect(
      w
        .findAll('[data-testid=sub-packages] button[role=radio]')
        .some((i) => i.attributes('aria-checked') === 'true'),
    ).toBe(false)
    expect((w.get('[data-testid=sub-quota]').element as HTMLInputElement).value).toBe('100')
    expect(w.get('[data-testid=sub-summary]').text()).toContain(
      'Pakej Pemantauan: PERCUMA · 500 soalan/bulan/pelajar · 1 bulan',
    )
    expect(w.get('[data-testid=sub-summary]').text()).toContain(
      'Sekolah boleh naik taraf ke Pakej Penuh bila-bila masa.',
    )
  })

  it('computes the full summary with the multi-year line only when maxRenewals > 0', async () => {
    const { w } = await render()
    await w.get('button[role=radio][value=full]').trigger('click')
    expect(w.find('[data-testid=sub-summary]').exists()).toBe(false)
    const radios = w.findAll('[data-testid=sub-packages] button[role=radio]')
    await radios[0]!.trigger('click')
    expect(w.get('[data-testid=sub-summary-line]').text()).toBe('100 pelajar × RM30.00/tahun')
    expect(w.get('[data-testid=sub-summary-total]').text()).toBe('RM3,000.00')
    expect(w.get('[data-testid=sub-summary-grand]').text()).toBe('Jumlah 2 tahun: RM6,000.00')
    await radios[2]!.trigger('click')
    expect(w.get('[data-testid=sub-summary-grand]').text()).toBe('Jumlah 6 tahun: RM18,000.00')
    await radios[1]!.trigger('click')
    expect(w.find('[data-testid=sub-summary-grand]').exists()).toBe(false)
  })

  it('draws the school result list in the flow, not floating (SWX4-05)', async () => {
    vi.useFakeTimers()
    vi.mocked(searchSchools).mockResolvedValue([
      {
        id: 77,
        name: 'SEKOLAH KEBANGSAAN CONTOH BARU',
        code: 'ABC0077',
        type: 'SK',
        state: 'Selangor',
        district: 'PPD GOMBAK',
        city: null,
      },
    ])
    try {
      const { w } = await render()
      await w.get('[data-testid=sub-school-search]').setValue('SEKOLAH')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      expectListInFlow(w, 'sub-school-dropdown')
    } finally {
      vi.mocked(searchSchools).mockResolvedValue([])
      vi.useRealTimers()
    }
  })

  it('limits the quota natively to 1-2000', async () => {
    const { w } = await render()
    const q = w.get('[data-testid=sub-quota]')
    expect(q.attributes('min')).toBe('1')
    expect(q.attributes('max')).toBe('2000')
    expect(q.attributes('required')).toBeDefined()
  })

  it('shows the server error and keeps the input', async () => {
    api.createSubscription.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { schoolId: 'The school id field is required.' },
      }),
    )
    const { w } = await render()
    await w.get('[data-testid=sub-reference]').setValue('REF-1')
    await w.get('[data-testid=sub-form]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=sub-form-alert]').text()).toContain(
      'The school id field is required.',
    )
    expect((w.get('[data-testid=sub-reference]').element as HTMLInputElement).value).toBe('REF-1')
  })

  it('creates and goes to the new subscription', async () => {
    api.createSubscription.mockResolvedValueOnce({
      data: { id: 1001 },
      status: 'Langganan berjaya dicipta.',
    })
    const { w, router } = await render()
    await w.get('[data-testid=sub-form]').trigger('submit')
    await flushPromises()
    expect(api.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ packageTier: 'basic', studentQuota: 100, schoolId: null }),
    )
    expect(router.currentRoute.value.path).toBe('/admin/school-subscriptions/1001')
  })
})

describe('SubscriptionCreatePage (M02 S13) one column below 768px (BUG-06, DV-M02-31)', () => {
  it('keeps the two-column grid for md and up only', async () => {
    const { w } = await render()
    expectOneColumnBelowMd(w)
  })
})
