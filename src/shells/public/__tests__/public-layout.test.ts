// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, type Router } from 'vue-router'

import { api, installTransport } from '@/api'
import LayoutHost from '@/app/LayoutHost.vue'
import { createAppRouter, setRouteOutcome } from '@/app/router'
import { fakeTransport, logIn, NOW, STUDENT } from '@/app/__tests__/router-fixtures'
import { clock } from '@/lib/time'
import { setUnauthorizedRedirect } from '@/stores'

import { PUBLIC_SECTIONS, publicSectionFor } from '../public-sections'
import { DETAIL_TITLE, PUBLIC_REGISTRY, USER_TITLE } from './public-fixtures'

// Both layouts are async components (layouts.ts); preload them so mounting resolves at once.
beforeAll(async () => {
  await import('../PublicLayout.vue')
  await import('@/shells/user/UserShell.vue')
})

let pinia: Pinia
let router: Router
let wrapper: VueWrapper | null = null

async function open(path: string): Promise<VueWrapper> {
  router = createAppRouter({ history: createMemoryHistory(), registry: PUBLIC_REGISTRY })
  await router.push(path)
  wrapper = mount(LayoutHost, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await flushPromises()
  await flushPromises()
  return wrapper
}

async function go(path: string): Promise<void> {
  await router.push(path)
  await flushPromises()
  await flushPromises()
}

/** The top-bar section label spans (emoji, text). */
const section = (w: VueWrapper) =>
  w
    .get('[data-testid="public-layout-section"]')
    .findAll('span')
    .map((s) => s.text())

/** The CTA decoration emoji, in DOM order. */
const decorations = (w: VueWrapper) =>
  w
    .get('[data-testid="public-layout-cta"]')
    .findAll('.absolute')
    .map((d) => d.text())

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
  clock.reset()
  pinia = createPinia()
  setActivePinia(pinia)
  setRouteOutcome(null)
  installTransport(
    fakeTransport((req) =>
      req.url === '/api/me/gamification-summary'
        ? { body: { data: { coins: 0, points: 0, streakDays: 0 } } }
        : {},
    ),
  )
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  document.title = ''
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  clock.reset()
  vi.useRealTimers()
  setUnauthorizedRedirect(null)
  api.configure({ transport: null })
  vi.restoreAllMocks()
})

describe('publicSectionFor', () => {
  it('maps the article and video paths, and nothing else', () => {
    expect(publicSectionFor('/artikel')?.key).toBe('artikel')
    expect(publicSectionFor('/artikel/tips-belajar')?.key).toBe('artikel')
    expect(publicSectionFor('/video')?.key).toBe('video')
    // Exactly `/video` (F-20 scope); a guest `/video/:id` is M09-T3's decision.
    expect(publicSectionFor('/video/2224')).toBeNull()
    expect(publicSectionFor('/video/tambah')).toBeNull()
    expect(publicSectionFor('/artikelx')).toBeNull()
    expect(publicSectionFor('/panduan')).toBeNull()
    expect(publicSectionFor('/')).toBeNull()
  })
})

describe('PublicLayout: guest on /artikel (FR-M09-29, FR-M09-31)', () => {
  it('renders the public layout, not the user shell, with the page in a plain div (no main, D10)', async () => {
    const w = await open('/artikel')
    expect(w.find('[data-layout="public"]').exists()).toBe(true)
    expect(w.find('[data-layout="user"]').exists()).toBe(false)
    const area = w.get('[data-testid="public-layout-main"]')
    expect(area.element.tagName).toBe('DIV')
    expect(area.find('[data-testid="artikel"]').exists()).toBe(true)
    // Live guest pages have no `main` landmark (inventory guest__1280: nav, form, section, footer).
    expect(document.querySelector('main')).toBeNull()
    expect(document.querySelector('[role="main"]')).toBeNull()
  })

  it('top bar: logo → /, "|", 📰 Artikel, Log Masuk → /login, Daftar Percuma → /register', async () => {
    const w = await open('/artikel')
    const nav = w.get('nav[data-testid="public-layout-topbar"]')
    const logo = nav.get('[data-testid="public-layout-logo"]')
    expect(logo.element.tagName).toBe('A')
    expect(logo.attributes('href')).toBe('/')
    expect(logo.get('img').attributes('alt')).toBe('PRESTASIPLUS')
    expect(logo.get('img').attributes('src')).toMatch(/images\/prestasiplus-logo\.svg$/)
    const spans = nav.findAll('span').map((s) => s.text())
    expect(spans).toContain('|')
    expect(spans).toContain('📰')
    expect(spans).toContain('Artikel')
    expect(section(w)).toEqual(['📰', 'Artikel'])
    const login = nav.get('[data-testid="public-layout-login"]')
    expect(login.text()).toBe('Log Masuk')
    expect(login.attributes('href')).toBe('/login')
    const register = nav.get('[data-testid="public-layout-register"]')
    expect(register.text()).toBe('Daftar Percuma')
    expect(register.attributes('href')).toBe('/register')
    // Top bar order: logo, separator, section, links.
    const t = nav.text()
    const at = ['|', '📰', 'Artikel', 'Log Masuk', 'Daftar Percuma'].map((s) => t.indexOf(s))
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(at.every((i) => i >= 0)).toBe(true)
  })

  it('CTA: exact article copy, emoji and the register link', async () => {
    const w = await open('/artikel')
    const cta = w.get('section[data-testid="public-layout-cta"]')
    expect(cta.get('h2').text()).toBe('Nak Baca Lebih Banyak?')
    expect(cta.text()).toContain(
      'Daftar percuma dan dapat akses penuh ke semua artikel, latih tubi interaktif, ganjaran menarik dan banyak lagi!',
    )
    const link = cta.get('[data-testid="public-layout-cta-register"]')
    expect(link.text()).toBe('Daftar Percuma Sekarang')
    expect(link.attributes('href')).toBe('/register')
    expect(link.find('svg.pp-icon').exists()).toBe(true) // fa-arrow-right
    expect(cta.text()).toContain('100% Percuma • Tiada Kad Kredit Diperlukan')
    expect(decorations(w)).toEqual(['📚', '✨', '🎯', '🚀', '⭐', '🎉'])
  })

  it('footer: logo, copyright and the five links in live order', async () => {
    const w = await open('/artikel')
    const footer = w.get('footer[data-testid="public-layout-footer"]')
    expect(footer.get('img').attributes('alt')).toBe('PRESTASIPLUS')
    expect(footer.text()).toContain(
      '© 2026 PRESTASIPLUS by GCM Technologies Sdn Bhd. Hak Cipta Terpelihara.',
    )
    const links = footer.findAll('a').map((a) => [a.text(), a.attributes('href')])
    expect(links).toEqual([
      ['Utama', '/'],
      ['Artikel', '/artikel'],
      ['Video', '/video'],
      ['Log Masuk', '/login'],
      ['Daftar', '/register'],
    ])
  })

  it('DOM order and elements: nav, div (page), section (CTA), footer', async () => {
    const w = await open('/artikel')
    const root = w.get('[data-layout="public"]').element
    const order = Array.from(root.children).map((el) => [
      el.tagName.toLowerCase(),
      el.getAttribute('data-testid'),
    ])
    expect(order).toEqual([
      ['nav', 'public-layout-topbar'],
      ['div', 'public-layout-main'],
      ['section', 'public-layout-cta'],
      ['footer', 'public-layout-footer'],
    ])
  })

  it('shows the route guest title over the route title, also on query changes', async () => {
    await open('/artikel')
    expect(document.title).toBe('Artikel — PRESTASIPLUS')
    await go('/artikel?page=2')
    expect(document.title).toBe('Artikel — PRESTASIPLUS')
  })
})

describe('PublicLayout: guest on /video (FR-M09-82)', () => {
  it('top bar 🎬 Video, video CTA copy, same footer, guest title', async () => {
    const w = await open('/video')
    expect(section(w)).toEqual(['🎬', 'Video'])
    const cta = w.get('[data-testid="public-layout-cta"]')
    expect(cta.get('h2').text()).toBe('Nak Tonton Lebih Banyak?')
    expect(cta.text()).toContain(
      'Daftar percuma dan dapat akses penuh ke semua video, latih tubi interaktif, ganjaran menarik dan banyak lagi!',
    )
    expect(cta.text()).toContain('Daftar Percuma Sekarang')
    expect(cta.text()).toContain('100% Percuma • Tiada Kad Kredit Diperlukan')
    expect(decorations(w)).toEqual(['🎬', '📚', '🎯', '🚀', '🎓'])
    expect(decorations(w)).toEqual(PUBLIC_SECTIONS.video.cta.decorations)
    expect(w.get('[data-testid="public-layout-footer"]').findAll('a')).toHaveLength(5)
    expect(document.title).toBe('Video Pembelajaran — PRESTASIPLUS')
  })
})

describe('PublicLayout: navigation and other paths', () => {
  it('stays mounted from /artikel to /video and switches section, CTA and title', async () => {
    const w = await open('/artikel')
    const el = w.get('[data-layout="public"]').element
    await go('/video')
    expect(w.get('[data-layout="public"]').element).toBe(el)
    expect(section(w)).toEqual(['🎬', 'Video'])
    expect(w.get('[data-testid="public-layout-cta"] h2').text()).toBe('Nak Tonton Lebih Banyak?')
    expect(document.title).toBe('Video Pembelajaran — PRESTASIPLUS')
    expect(w.find('[data-testid="video"]').exists()).toBe(true)
  })

  it('/artikel/:slug (provisional, FR-M09-39): article section; a page title set by the page wins', async () => {
    const w = await open('/artikel/tips-belajar')
    expect(section(w)).toEqual(['📰', 'Artikel'])
    expect(w.find('[data-testid="artikel-detail"]').exists()).toBe(true)
    expect(document.title).toBe(DETAIL_TITLE)
  })

  it('mounted on /artikel, then /artikel/x: the page setTitle wins over the guest title', async () => {
    const w = await open('/artikel')
    expect(document.title).toBe('Artikel — PRESTASIPLUS')
    await go('/artikel/x')
    expect(w.find('[data-testid="artikel-detail"]').exists()).toBe(true)
    expect(section(w)).toEqual(['📰', 'Artikel'])
    expect(document.title).toBe(DETAIL_TITLE)
  })

  it('another public-or-user path: no section label and no CTA, route title kept', async () => {
    const w = await open('/lain')
    expect(w.find('[data-layout="public"]').exists()).toBe(true)
    expect(w.find('[data-testid="public-layout-section"]').exists()).toBe(false)
    expect(w.find('[data-testid="public-layout-cta"]').exists()).toBe(false)
    expect(w.find('[data-testid="public-layout-footer"]').exists()).toBe(true)
    expect(document.title).toBe('Lain')
  })
})

describe('public-or-user when logged in', () => {
  it('a logged-in user on /artikel gets the user shell, not the public layout', async () => {
    logIn(STUDENT)
    const w = await open('/artikel')
    expect(w.find('[data-layout="user"]').exists()).toBe(true)
    expect(w.find('[data-layout="public"]').exists()).toBe(false)
    expect(w.find('[data-testid="public-layout-topbar"]').exists()).toBe(false)
    expect(document.title).toBe(USER_TITLE)
  })
})
