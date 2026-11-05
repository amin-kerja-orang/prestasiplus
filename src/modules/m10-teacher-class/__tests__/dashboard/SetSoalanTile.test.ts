// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { GuruDashboard } from '../../api/types'
import GuruDashboardPage from '../../pages/GuruDashboardPage.vue'

/**
 * S6-T14 (R1-GUR-8b, FR-GUR-2-2): the Dashboard tile "Set Soalan" carries the link "Urus set →" and opens
 * `/guru/set-soalan`. The tile entry itself arrives with the S6-T07 Dashboard card (#665); until it is on
 * this base the test supplies the entry through the copy module and checks the rendering support.
 */

vi.mock('../../components/dashboard/copy', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../components/dashboard/copy')>()
  const quick = mod.DASH_COPY.quick.map((q, i) =>
    i === 3
      ? {
          title: 'Set Soalan',
          text: 'Bina & terbitkan set latihan.',
          to: '/guru/set-soalan',
          link: 'Urus set →',
        }
      : q,
  )
  return { ...mod, DASH_COPY: { ...mod.DASH_COPY, quick } }
})

const api = vi.hoisted(() => ({ fetchGuruDashboard: vi.fn() }))
vi.mock('../../api/guru', () => api)

const dash = (): GuruDashboard => ({
  checklist: { hasClass: false, hasStudents: false, hasMission: false },
  stats: {
    activeClasses: 0,
    totalClasses: 0,
    students: 0,
    questions: 0,
    questionsApproved: 0,
    assignments: 0,
  },
  today: { students: [], topics: [], actions: [] },
  peerTutor: [],
  classes: [],
  submissions: [],
})

let wrapper: VueWrapper | undefined
beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  api.fetchGuruDashboard.mockResolvedValue(dash())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('Dashboard tile "Set Soalan"', () => {
  it('shows "Urus set →" and opens /guru/set-soalan; tiles without a link show none', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/guru')
    await router.isReady()
    wrapper = mount(GuruDashboardPage, { global: { plugins: [router] } })
    await flushPromises()
    const tile = wrapper
      .findAll('[data-testid="quick-tile"]')
      .find((t) => t.attributes('href') === '/guru/set-soalan')
    expect(tile).toBeDefined()
    expect(tile?.text()).toContain('Set Soalan')
    expect(tile?.get('[data-testid="quick-tile-link"]').text()).toBe('Urus set →')
    expect(wrapper.findAll('[data-testid="quick-tile-link"]')).toHaveLength(1)

    await tile?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/guru/set-soalan')
  })
})
