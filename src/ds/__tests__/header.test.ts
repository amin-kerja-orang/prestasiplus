// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  DsBackLink,
  DsBreadcrumb,
  DsPage,
  DsPageHeader,
  DsPillNav,
  provideShellTitle,
} from '@/ds'

/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  document.body.innerHTML = ''
})

const Blank = { template: '<div />' }
function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Blank },
      { path: '/a', component: Blank },
      { path: '/shell', component: Blank, meta: { shellTitle: true } },
    ],
  })
}

describe('DsBackLink', () => {
  it('links with the default label Kembali', () => {
    const router = makeRouter()
    const w = mount(DsBackLink, { props: { to: '/a' }, global: { plugins: [router] } })
    expect(w.text()).toBe('Kembali')
    expect(w.get('a').attributes('href')).toBe('/a')
  })
})

describe('DsPageHeader', () => {
  it('prints one h1 with subtitle, test ids and all slots', () => {
    const router = makeRouter()
    const w = mount(DsPageHeader, {
      props: {
        title: 'Pengguna',
        subtitle: 'Urus akaun',
        titleTestid: 't',
        subtitleTestid: 's',
        backTo: '/a',
      },
      slots: {
        leading: '<i data-x="lead" />',
        breadcrumb: '<nav data-x="crumb" />',
        actions: '<button>Tambah Pengguna</button>',
        tabs: '<div data-x="tabs" />',
        meta: '<span data-x="meta" />',
      },
      global: { plugins: [router] },
    })
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.get('[data-testid="t"]').text()).toBe('Pengguna')
    expect(w.get('[data-testid="s"]').text()).toBe('Urus akaun')
    expect(w.text()).toContain('Kembali')
    for (const x of ['lead', 'crumb', 'tabs', 'meta'])
      expect(w.find(`[data-x="${x}"]`).exists()).toBe(true)
    expect(w.text()).toContain('Tambah Pengguna')
  })
  it('hides the h1 when the shell prints it (route meta shellTitle)', async () => {
    const router = makeRouter()
    await router.push('/shell')
    await router.isReady()
    const w = mount(DsPageHeader, {
      props: { title: 'Pengguna', subtitle: 'Urus akaun' },
      global: { plugins: [router] },
    })
    expect(w.find('h1').exists()).toBe(false)
    expect(w.text()).toContain('Urus akaun')
    const forced = mount(DsPageHeader, {
      props: { title: 'Pengguna', showTitle: true },
      global: { plugins: [router] },
    })
    expect(forced.find('h1').exists()).toBe(true)
  })
  it('hides the h1 under a layout that calls provideShellTitle; showTitle=false always hides', () => {
    const Layout = defineComponent({
      setup() {
        provideShellTitle()
        return () => h(DsPageHeader, { title: 'Pengguna', subtitle: 'x' })
      },
    })
    expect(mount(Layout).find('h1').exists()).toBe(false)
    expect(mount(DsPageHeader, { props: { title: 'A', showTitle: false } }).find('h1').exists()).toBe(
      false,
    )
    expect(mount(DsPageHeader, { props: { title: 'A' } }).find('h1').exists()).toBe(true)
  })
  it('renders nothing when there is nothing to show', () => {
    expect(mount(DsPageHeader).find('header').exists()).toBe(false)
  })
})

describe('DsPage', () => {
  it('delegates to DsPageHeader and forwards slots', () => {
    const w = mount(DsPage, {
      props: { title: 'Laporan', subtitle: 'Bulan ini' },
      slots: { actions: '<button>Cetak</button>', default: '<p data-x="body" />' },
    })
    expect(w.findComponent(DsPageHeader).exists()).toBe(true)
    expect(w.get('h1').text()).toBe('Laporan')
    expect(w.text()).toContain('Cetak')
    expect(w.find('[data-x="body"]').exists()).toBe(true)
  })
  it('has no header when nothing is given', () => {
    expect(mount(DsPage, { slots: { default: '<p />' } }).find('header').exists()).toBe(false)
  })
})

describe('DsBreadcrumb', () => {
  it('links the earlier items, marks the last as current, collapses the rest below md', () => {
    const router = makeRouter()
    const w = mount(DsBreadcrumb, {
      props: {
        items: [
          { label: 'Utama', to: '/' },
          { label: 'Kelas', to: '/a' },
          { label: 'Laporan', to: '/a' },
          { label: 'Bulanan' },
        ],
      },
      global: { plugins: [router] },
    })
    expect(w.get('nav').attributes('aria-label')).toBe('Jejak navigasi')
    expect(w.get('[aria-current="page"]').text()).toBe('Bulanan')
    const items = w.findAll('[data-ds="breadcrumb-item"]')
    expect(items[0]!.classes()).toContain('hidden')
    expect(items[1]!.classes()).toContain('hidden')
    expect(items[2]!.classes()).not.toContain('hidden')
    expect(w.find('[data-ds="breadcrumb-more"]').exists()).toBe(true)
  })
  it('two items need no overflow', () => {
    const w = mount(DsBreadcrumb, {
      props: { items: [{ label: 'A', to: '/' }, { label: 'B' }] },
      global: { plugins: [makeRouter()] },
    })
    expect(w.find('[data-ds="breadcrumb-more"]').exists()).toBe(false)
  })
})

describe('DsPillNav', () => {
  const items = [
    { key: 'a', label: 'Bulan' },
    { key: 'b', label: 'Tahun' },
  ]
  it('buttons: data-active, aria-pressed, test ids and select', async () => {
    const w = mount(DsPillNav, {
      props: { items, active: 'a', label: 'Tempoh', testidPrefix: 'tempoh' },
      global: { plugins: [makeRouter()] },
    })
    const a = w.get('[data-testid="tempoh-a"]')
    expect(a.attributes('data-active')).toBe('true')
    expect(a.attributes('aria-pressed')).toBe('true')
    const b = w.get('[data-testid="tempoh-b"]')
    expect(b.attributes('data-active')).toBe('false')
    await b.trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['b'])
  })
  it('wrap: the strip wraps instead of scrolling; default keeps the scroll', () => {
    const on = mount(DsPillNav, {
      props: { items, active: 'a', label: 'Tempoh', wrap: true },
      global: { plugins: [makeRouter()] },
    })
    const strip = on.get('[data-ds="pill-nav"] > div')
    expect(strip.classes()).toContain('flex-wrap')
    expect(strip.classes()).not.toContain('overflow-x-auto')
    const off = mount(DsPillNav, {
      props: { items, active: 'a', label: 'Tempoh' },
      global: { plugins: [makeRouter()] },
    })
    expect(off.get('[data-ds="pill-nav"] > div').classes()).toContain('overflow-x-auto')
  })
  it('links: aria-current on the active one, no select', async () => {
    const w = mount(DsPillNav, {
      props: {
        items: [
          { key: 1, label: 'Satu', to: '/' },
          { key: 2, label: 'Dua', to: '/a' },
        ],
        active: 2,
        label: 'Tingkatan',
        testidPrefix: 'p',
      },
      global: { plugins: [makeRouter()] },
    })
    expect(w.get('[data-testid="p-2"]').attributes('aria-current')).toBe('page')
    expect(w.get('[data-testid="p-1"]').attributes('href')).toBe('/')
    await w.get('[data-testid="p-1"]').trigger('click')
    expect(w.emitted('select')).toBeUndefined()
  })
})
