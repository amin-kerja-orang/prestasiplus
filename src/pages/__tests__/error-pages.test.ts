// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import ForbiddenPage from '../ForbiddenPage.vue'
import NotFoundPage from '../NotFoundPage.vue'

const Stub: Component = { template: '<div />' }

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/practice', component: Stub },
      { path: '/login', component: Stub },
      { path: '/:pathMatch(.*)*', component: Stub },
    ],
  })
}

let wrapper: VueWrapper | null = null

async function render(page: Component): Promise<{ w: VueWrapper; router: Router }> {
  const router = makeRouter()
  await router.push('/tiada-halaman')
  wrapper = mount(page, { global: { plugins: [router] } })
  await flushPromises()
  return { w: wrapper, router }
}

function links(w: VueWrapper): [string, string | undefined][] {
  return w.findAll('a').map((a) => [a.text(), a.attributes('href')])
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('NotFoundPage (M01 S10, FR-M01-50)', () => {
  it('renders the exact live copy through DsErrorPage', async () => {
    const { w } = await render(NotFoundPage)
    const root = w.get('main')
    expect(root.attributes('data-page')).toBe('not-found')
    expect(root.attributes('data-testid')).toBe('app-placeholder')
    expect(w.get('[data-ds=error-page]').attributes('data-code')).toBe('404')
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.get('h1').text()).toBe('Halaman Tidak Dijumpai')
    expect(w.text()).toContain(
      'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
    )
    expect(w.text()).toContain('PRESTASIPLUS')
  })

  it('links "Halaman Utama" to / and "Mula Latihan" to /practice (DV-02)', async () => {
    const { w } = await render(NotFoundPage)
    expect(links(w)).toEqual([
      ['Halaman Utama', '/'],
      ['Mula Latihan', '/practice'],
    ])
    expect(w.html()).not.toContain('/latih-tubi')
  })

  it('shows the icon chip for a guest (staff look)', async () => {
    const { w } = await render(NotFoundPage)
    expect(w.find('[data-ds=icon-chip]').exists()).toBe(true)
  })

  it('navigates in-app when a link is clicked', async () => {
    const { w, router } = await render(NotFoundPage)
    await w.get('a[href="/practice"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/practice')
  })
})

describe('ForbiddenPage (M08 FN-M08-1.2.4)', () => {
  it('renders the exact live copy through DsErrorPage', async () => {
    const { w } = await render(ForbiddenPage)
    const root = w.get('main')
    expect(root.attributes('data-page')).toBe('forbidden')
    expect(root.attributes('data-testid')).toBeUndefined()
    expect(w.get('[data-ds=error-page]').attributes('data-code')).toBe('403')
    expect(w.get('h1').text()).toBe('Akses Ditolak')
    expect(w.text()).toContain(
      'Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.',
    )
  })

  it('links "Halaman Utama" to / and "Log Masuk" to /login', async () => {
    const { w } = await render(ForbiddenPage)
    expect(links(w)).toEqual([
      ['Halaman Utama', '/'],
      ['Log Masuk', '/login'],
    ])
  })
})
