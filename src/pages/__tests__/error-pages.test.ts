// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
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

/** Text of every leaf element, in document order. */
function leafTexts(w: VueWrapper): string[] {
  const root = w.element as HTMLElement
  return Array.from(root.querySelectorAll('*'))
    .filter((el) => el.children.length === 0)
    .map((el) => (el.textContent ?? '').trim())
}

function links(w: VueWrapper): [string, string | undefined][] {
  return w.findAll('a').map((a) => [a.text(), a.attributes('href')])
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('NotFoundPage (M01 S10, FR-M01-50)', () => {
  it('renders the exact live copy in order', async () => {
    const { w } = await render(NotFoundPage)
    const root = w.get('main')
    expect(root.attributes('data-page')).toBe('not-found')
    expect(root.attributes('data-testid')).toBe('app-placeholder')
    expect(leafTexts(w)).toEqual([
      '404',
      '🔍',
      'Halaman Tidak Dijumpai',
      'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
      'Halaman Utama',
      'Mula Latihan',
      'PRESTASIPLUS',
    ])
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.get('h1').text()).toBe('Halaman Tidak Dijumpai')
    expect(w.get('p').text()).toBe(
      'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
    )
  })

  it('links "Halaman Utama" to / and "Mula Latihan" to /practice (DV-02)', async () => {
    const { w } = await render(NotFoundPage)
    expect(links(w)).toEqual([
      ['Halaman Utama', '/'],
      ['Mula Latihan', '/practice'],
    ])
    expect(w.html()).not.toContain('/latih-tubi')
  })

  it('uses the system font on the root and the heading, the 404 token and the violet-600 primary pill', async () => {
    const { w } = await render(NotFoundPage)
    const root = w.get('main')
    expect(root.classes()).toContain('font-sans')
    expect(w.get('h1').classes()).toContain('font-sans')
    expect(root.classes()).toContain('bg-error-page')
    expect(w.get('a[href="/"]').classes()).toContain('text-violet-600')
  })

  it('navigates in-app when a link is clicked', async () => {
    const { w, router } = await render(NotFoundPage)
    await w.get('a[href="/practice"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/practice')
  })
})

describe('ForbiddenPage (M08 FN-M08-1.2.4)', () => {
  it('renders the exact live copy in order', async () => {
    const { w } = await render(ForbiddenPage)
    const root = w.get('main')
    expect(root.attributes('data-page')).toBe('forbidden')
    expect(root.attributes('data-testid')).toBeUndefined()
    expect(leafTexts(w)).toEqual([
      '403',
      '🚫',
      'Akses Ditolak',
      'Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.',
      'Halaman Utama',
      'Log Masuk',
      'PRESTASIPLUS',
    ])
    expect(w.get('h1').text()).toBe('Akses Ditolak')
  })

  it('links "Halaman Utama" to / and "Log Masuk" to /login', async () => {
    const { w } = await render(ForbiddenPage)
    expect(links(w)).toEqual([
      ['Halaman Utama', '/'],
      ['Log Masuk', '/login'],
    ])
  })

  it('uses the 403 token, the red-600 primary pill and the system font', async () => {
    const { w } = await render(ForbiddenPage)
    const root = w.get('main')
    expect(root.classes()).toEqual(expect.arrayContaining(['font-sans', 'bg-forbidden-page']))
    expect(w.get('a[href="/"]').classes()).toContain('text-red-600')
    expect(w.get('h1').classes()).toContain('font-sans')
  })
})
