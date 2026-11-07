// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { api } from '@/api'

import GamificationDashboardPage from '../../pages/GamificationDashboardPage.vue'
import { dashboard, ledgerRow } from './fixtures'

afterEach(() => vi.restoreAllMocks())

describe('S11 dashboard request (ruling 26 on #500)', () => {
  it('asks the API for the latest ten transactions: GET /api/gamification/transactions with limit=10', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/gamification/dashboard'
          ? dashboard()
          : { data: [ledgerRow(1)], meta: { currentSyiling: 256, type: '' } },
      ),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/gamification')
    await router.isReady()
    const w = mount(GamificationDashboardPage, { global: { plugins: [router] } })
    await flushPromises()
    const calls = get.mock.calls.filter(([url]) => url === '/api/gamification/transactions')
    expect(calls).toHaveLength(1)
    expect((calls[0]![1] as { query?: Record<string, unknown> }).query).toMatchObject({ limit: 10 })
    w.unmount()
  })
})
