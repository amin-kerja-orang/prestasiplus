// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router'
import { setRouteOutcome } from '@/app/router/outcome'

import HeadcountExportPage from '../../pages/HeadcountExportPage.vue'
import HeadcountShellPage from '../../pages/HeadcountShellPage.vue'

const api = vi.hoisted(() => ({
  downloadHeadcountCsv: vi.fn(),
  fetchHeadcountSummary: vi.fn(),
}))
vi.mock('../../api/headcount', () => api)
const save = vi.hoisted(() => ({ saveBlob: vi.fn() }))
vi.mock('@/lib/save-blob', () => save)

let wrapper: VueWrapper | null = null
let router: Router

async function render(
  component: object,
  path: string,
  route: string,
  beforeMount?: (r: Router) => void,
) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route, component })
  await router.push(path)
  beforeMount?.(router)
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  for (const fn of [...Object.values(api), ...Object.values(save)]) fn.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('HeadcountExportPage', () => {
  const FILE = { blob: new Blob(['x']), filename: 'headcount-501.csv' }

  it('downloads the CSV (sort kept) and replaces the URL with S23 when there is no history', async () => {
    api.downloadHeadcountCsv.mockResolvedValue(FILE)
    await render(HeadcountExportPage, '/headcount/501/export?sort=name', '/headcount/:id/export')
    expect(api.downloadHeadcountCsv.mock.calls[0]?.[0]).toBe(501)
    expect(api.downloadHeadcountCsv.mock.calls[0]?.[1]).toMatchObject({ sort: 'name' })
    expect(save.saveBlob).toHaveBeenCalledWith(FILE.blob, 'headcount-501.csv')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/headcount/501'))
  })

  it('goes back in the history when there is one', async () => {
    api.downloadHeadcountCsv.mockResolvedValue(FILE)
    window.history.replaceState({ back: '/headcount/501' }, '')
    let back = vi.fn()
    await render(HeadcountExportPage, '/headcount/501/export', '/headcount/:id/export', (r) => {
      back = vi.spyOn(r, 'back').mockImplementation(() => undefined)
    })
    window.history.replaceState(null, '')
    expect(save.saveBlob).toHaveBeenCalledTimes(1)
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('an unknown id is the 404 page and a forbidden config the 403 page; nothing is saved', async () => {
    api.downloadHeadcountCsv.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(HeadcountExportPage, '/headcount/9/export', '/headcount/:id/export')
    expect(useRouteOutcome().value).toBe(404)
    wrapper?.unmount()
    setRouteOutcome(null)
    api.downloadHeadcountCsv.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    await render(HeadcountExportPage, '/headcount/9/export', '/headcount/:id/export')
    expect(useRouteOutcome().value).toBe(403)
    expect(save.saveBlob).not.toHaveBeenCalled()
  })
})

describe('HeadcountShellPage', () => {
  const SUMMARY = { config: { id: 501, activeOtrs: 3 } }

  it('shows only the back link to S23', async () => {
    api.fetchHeadcountSummary.mockResolvedValue(SUMMARY)
    const w = await render(HeadcountShellPage, '/headcount/501/edit', '/headcount/:id/edit')
    expect(w.get('[data-testid=back-link]').attributes('href')).toBe('/headcount/501')
    expect(useRouteOutcome().value).toBeNull()
  })

  it.each([
    [1, null],
    [3, null],
    [0, 404],
    [4, 404],
  ])('results/%s → outcome %s', async (n, outcome) => {
    api.fetchHeadcountSummary.mockResolvedValue(SUMMARY)
    await render(
      HeadcountShellPage,
      `/headcount/501/results/${String(n)}`,
      '/headcount/:id/results/:n',
    )
    expect(useRouteOutcome().value).toBe(outcome)
  })

  it('an unknown config is the 404 page, a forbidden one the 403 page', async () => {
    api.fetchHeadcountSummary.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(HeadcountShellPage, '/headcount/9/edit', '/headcount/:id/edit')
    expect(useRouteOutcome().value).toBe(404)
    wrapper?.unmount()
    setRouteOutcome(null)
    api.fetchHeadcountSummary.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    await render(HeadcountShellPage, '/headcount/9/edit', '/headcount/:id/edit')
    expect(useRouteOutcome().value).toBe(403)
  })
})
