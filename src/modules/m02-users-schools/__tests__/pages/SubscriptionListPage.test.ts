// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { SubscriptionListItem } from '../../api/subscriptions'
import SubscriptionListPage from '../../pages/SubscriptionListPage.vue'

const api = vi.hoisted(() => ({ fetchSubscriptions: vi.fn() }))
vi.mock('../../api/subscriptions', () => api)

function row(id: number, extra: Partial<SubscriptionListItem> = {}): SubscriptionListItem {
  return {
    id,
    school: { id: id + 100, name: `SMK CONTOH ${String(id)}`, code: `ABC${String(id)}` },
    formLevel: 't5',
    packageTier: 'basic',
    used: 150,
    studentQuota: 1000,
    status: 'active',
    startsAt: '2026-05-12T10:00:00+08:00',
    endsAt: '2027-05-12T10:00:00+08:00',
    ...extra,
  }
}

function result(rows: SubscriptionListItem[]) {
  return { data: rows, meta: { counts: { active: 9, grace: 0, expired: 1, totalQuota: 5738 } } }
}

let wrapper: VueWrapper | null = null

async function render(url = '/admin/school-subscriptions') {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/admin/school-subscriptions',
        name: 'm02.subscriptions.list',
        component: SubscriptionListPage,
      },
      {
        path: '/admin/school-subscriptions/create',
        name: 'm02.subscriptions.create',
        component: stub,
      },
      {
        path: '/admin/school-subscriptions/:id',
        name: 'm02.subscriptions.detail',
        component: stub,
      },
    ],
  })
  await router.push(url)
  wrapper = mount(SubscriptionListPage, { global: { plugins: [router] } })
  await flushPromises()
  return { w: wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchSubscriptions.mockReset()
  api.fetchSubscriptions.mockResolvedValue(
    result([
      row(1),
      row(2, { packageTier: 'full', status: 'cancelled', used: 562, studentQuota: 500 }),
      row(3, { status: 'expired', formLevel: 'd1_d6' }),
    ]),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('SubscriptionListPage (M02 S12)', () => {
  it('shows the four stat cards with the active-only quota sum', async () => {
    const { w } = await render()
    expect(w.get('[data-testid=subs-stat-active]').text()).toContain('9')
    expect(w.get('[data-testid=subs-stat-grace]').text()).toContain('Tempoh Ihsan')
    expect(w.get('[data-testid=subs-stat-expired]').text()).toContain('Tamat Tempoh')
    expect(w.get('[data-testid=subs-stat-quota]').text()).toContain('5,738')
    expect(w.get('[data-testid=subs-stat-quota]').text()).toContain('Jumlah Kuota Pelajar')
  })

  it('renders the rows with level, tier, quota, status labels and dd/mm/yyyy dates', async () => {
    const { w } = await render()
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.get('[data-testid=subs-level-badge]').text()).toBe('T5')
    expect(rows[0]!.get('[data-testid=subs-tier-badge]').text()).toBe('Pemantauan')
    expect(rows[0]!.get('[data-testid=subs-quota]').text()).toBe('150/1000')
    expect(rows[0]!.text()).toContain('12/05/2026')
    expect(rows[0]!.text()).toContain('12/05/2027')
    expect(rows[1]!.get('[data-testid=subs-tier-badge]').text()).toBe('Penuh')
    expect(rows[1]!.get('[data-testid=subs-status-badge]').text()).toBe('Batal')
    expect(rows[2]!.get('[data-testid=subs-status-badge]').text()).toBe('Tamat')
    expect(rows[2]!.get('[data-testid=subs-level-badge]').text()).toBe('D1_D6')
    expect(rows[0]!.get('[data-testid=subs-view]').attributes('href')).toBe(
      '/admin/school-subscriptions/1',
    )
  })

  it('offers the status and level filters and puts them in the URL on "Cari"', async () => {
    const { w, router } = await render()
    expect(w.findAll('[data-testid=subs-status] option').map((o) => o.text())).toEqual([
      'Semua Status',
      'Aktif',
      'Tempoh Ihsan',
      'Tamat',
      'Dibatalkan',
    ])
    expect(w.findAll('[data-testid=subs-level] option').map((o) => o.text())).toEqual([
      'Semua Tingkatan',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    await w.get('[data-testid=subs-search]').setValue('kluang')
    await w.get('[data-testid=subs-status]').setValue('expired')
    await w.get('[data-testid=subs-filter]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ search: 'kluang', status: 'expired' })
    expect(api.fetchSubscriptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'kluang', status: 'expired', formLevel: null }),
    )
  })

  it('shows the empty row', async () => {
    api.fetchSubscriptions.mockResolvedValue(result([]))
    const { w } = await render('/admin/school-subscriptions?search=zzz')
    const empty = w.get('[data-testid=subs-empty]')
    expect(empty.text()).toBe('Tiada langganan dijumpai.')
  })

  it('shows a red alert with a retry when the list fails', async () => {
    api.fetchSubscriptions.mockRejectedValueOnce(new Error('boom'))
    const { w } = await render()
    expect(w.find('[data-testid=subs-error]').exists()).toBe(true)
    await w
      .findAll('button')
      .find((b) => b.text() === 'Cuba Semula')!
      .trigger('click')
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(3)
  })
})
