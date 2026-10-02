// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { usePageMeta } from '@/composables'
import { useRouteOutcome, setRouteOutcome } from '@/app/router/outcome'

import type { ArticleCard, ArticleDetail, HotCard } from '../../api'
import ArtikelDetailPage from '../../pages/ArtikelDetailPage.vue'
import ArtikelListPage from '../../pages/ArtikelListPage.vue'

const api = vi.hoisted(() => ({
  fetchArticles: vi.fn(),
  fetchHotArticles: vi.fn(),
  fetchArticle: vi.fn(),
  fetchLatestArticles: vi.fn(),
}))
vi.mock('../../api', () => api)

const session = vi.hoisted(() => ({ loggedIn: true }))
vi.mock('@/composables/useSession', async () => {
  const { ref: r } = await import('vue')
  const isLoggedIn = r(true)
  return {
    useSession: () => {
      isLoggedIn.value = session.loggedIn
      return { isLoggedIn }
    },
  }
})

function card(id: number, extra: Partial<ArticleCard> = {}): ArticleCard {
  return {
    id,
    slug: `artikel-${String(id)}`,
    title: `Artikel ${String(id)}`,
    excerpt: `Ringkasan ${String(id)}`,
    category: 'TIPS_BELAJAR',
    categoryLabel: 'Tips Belajar',
    isFeatured: false,
    views: 310,
    publishedAt: '2026-02-22T10:00:00+08:00',
    author: { name: 'Cikgu Demo 01', initial: 'C' },
    ...extra,
  }
}

function list(rows: ArticleCard[], total = rows.length) {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize: 18,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 18)),
      from: rows.length ? 1 : null,
      to: rows.length || null,
    },
  }
}

const HOT: HotCard[] = [
  { ...card(101, { isFeatured: true }), badge: 'PILIHAN' },
  { ...card(102), badge: 'POPULAR' },
]

let wrapper: VueWrapper | null = null
let router: Router

async function mountAt(url: string, component: object): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/artikel', component: ArtikelListPage },
      { path: '/artikel/:slug', component: ArtikelDetailPage, props: true },
      { path: '/dashboard', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(component, {
    props: component === ArtikelDetailPage ? { slug: router.currentRoute.value.params.slug } : {},
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  session.loggedIn = true
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchArticles.mockResolvedValue(list([card(1, { isFeatured: true }), card(2)], 72))
  api.fetchHotArticles.mockResolvedValue({ data: HOT, meta: list(HOT).meta })
  usePageMeta().reset()
  setRouteOutcome(null)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('ArtikelListPage (S15)', () => {
  it('logged in: hot section, grid cards, pager keeping nothing extra', async () => {
    const w = await mountAt('/artikel', ArtikelListPage)
    expect(w.find('[data-testid=artikel-hero]').exists()).toBe(false)
    expect(w.get('[data-testid=artikel-hot-heading]').text()).toBe('Artikel Paling Hangat')
    const badges = w.findAll('[data-testid=artikel-hot-badge]').map((b) => b.text())
    expect(badges).toEqual(['PILIHAN', 'POPULAR'])
    const cards = w.findAll('[data-testid=artikel-card]')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.get('[data-testid=artikel-card-hot]').text()).toBe('HOT')
    expect(cards[1]?.find('[data-testid=artikel-card-hot]').exists()).toBe(false)
    expect(cards[0]?.attributes('href')).toBe('/artikel/artikel-1')
    expect(cards[0]?.get('[data-testid=artikel-card-views]').text()).toBe('👁️ 310')
    expect(cards[0]?.find('[data-icon=clock]').exists()).toBe(false)
    expect(w.get('[data-testid=artikel-search-input]').attributes('placeholder')).toBe(
      'Cari artikel...',
    )
    expect(w.text()).toContain('Showing 1 to 18 of 72 results')
  })

  it('search or category hides the hot section, keeps the filters on pills', async () => {
    const w = await mountAt('/artikel?category=BERITA&search=sifir', ArtikelListPage)
    expect(w.find('[data-testid=artikel-hot]').exists()).toBe(false)
    expect(api.fetchHotArticles).not.toHaveBeenCalled()
    expect(api.fetchArticles).toHaveBeenCalledWith(
      { search: 'sifir', category: 'BERITA', page: 1 },
      expect.anything(),
    )
    const pills = w.findAll('[data-testid=artikel-pill]')
    expect(pills.map((p) => p.text())).toEqual([
      'Semua',
      'Tips Belajar',
      'Berita',
      'Motivasi',
      'Panduan Ibu Bapa',
      'Panduan Guru',
      'Kejayaan',
      'Umum',
    ])
    expect(pills[0]?.attributes('href')).toBe('/artikel?search=sifir')
    expect(pills[2]?.attributes('href')).toBe('/artikel?search=sifir&category=BERITA')
    expect(pills[2]?.attributes('data-active')).toBe('true')
    expect(w.get('input[type=hidden][name=category]').attributes('value')).toBe('BERITA')
  })

  it('submitting the search pushes ?search and keeps the category', async () => {
    const w = await mountAt('/artikel?category=UMUM', ArtikelListPage)
    await w.get('[data-testid=artikel-search-input]').setValue('  sifir ')
    await w.get('[data-testid=artikel-search-form]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/artikel?search=sifir&category=UMUM')
  })

  it('empty result shows the empty state without grid and pager', async () => {
    api.fetchArticles.mockResolvedValue(list([]))
    const w = await mountAt('/artikel?search=zzzqqq', ArtikelListPage)
    const empty = w.get('[data-testid=artikel-empty]')
    expect(empty.text()).toContain('Tiada Artikel Dijumpai')
    expect(empty.text()).toContain('Cuba ubah carian atau pilih kategori lain.')
    expect(w.get('[data-testid=artikel-empty-action]').attributes('href')).toBe('/artikel')
    expect(w.text()).toContain('Lihat Semua Artikel')
    expect(w.find('[data-testid=artikel-grid]').exists()).toBe(false)
    expect(w.find('nav[aria-label="Pagination Navigation"]').exists()).toBe(false)
  })

  it('the pager keeps category and search', async () => {
    api.fetchArticles.mockResolvedValue(list([card(1)], 21))
    const w = await mountAt('/artikel?category=TIPS_BELAJAR&page=2', ArtikelListPage)
    const hrefs = w
      .findAll('nav[aria-label="Pagination Navigation"] a')
      .map((a) => a.attributes('href'))
    expect(hrefs).toContain('/artikel?category=TIPS_BELAJAR&page=1')
  })

  it('guest: hero, clock before the date, guest copy and "✨" pills', async () => {
    session.loggedIn = false
    const w = await mountAt('/artikel', ArtikelListPage)
    expect(w.get('h1').text()).toBe('Artikel Pilihan')
    expect(w.findAll('[data-testid=artikel-hero-line] .font-bold').map((s) => s.text())).toEqual([
      'tips belajar',
      'berita pendidikan',
      'motivasi',
      'panduan',
    ])
    expect(w.get('[data-testid=artikel-search-input]').attributes('placeholder')).toBe(
      'Cari artikel menarik...',
    )
    expect(w.text()).toContain('Pilih Kategori:')
    expect(w.findAll('[data-testid=artikel-pill]')[1]?.text()).toBe('✨ Tips Belajar')
    expect(w.find('[data-testid=artikel-card-date] [data-icon=clock]').exists()).toBe(true)
    expect(w.get('[data-testid=artikel-hot-heading]').text()).toContain('🔥')
  })
})

const DETAIL: ArticleDetail = {
  ...card(10, {
    title: 'Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit',
    slug: 'teknik-pomodoro',
    isFeatured: true,
    views: 597,
    publishedAt: '2025-12-24T10:00:00+08:00',
    author: { name: 'Admin Demo', initial: 'A' },
  }),
  content:
    '<h2>Apa Itu Teknik Pomodoro?</h2><p>Isi</p><ol><li>1</li><li>2</li></ol><script>window.x=1</script><img src="x" onerror="window.x=2">',
  gradeLevel: 'DARJAH_4',
  gradeLabel: 'Darjah 4',
  likes: 6,
  related: [card(9), card(1), card(2)],
}

describe('ArtikelDetailPage (S16)', () => {
  beforeEach(() => {
    api.fetchArticle.mockResolvedValue(DETAIL)
    api.fetchLatestArticles.mockResolvedValue({ data: [card(1), card(2)], meta: list([]).meta })
  })

  it('renders header, breadcrumb, chips, author card and the sanitised body', async () => {
    const w = await mountAt('/artikel/teknik-pomodoro', ArtikelDetailPage)
    expect(usePageMeta().state.header).toEqual({ title: DETAIL.title, subtitle: 'Artikel' })
    expect(w.get('[data-testid=artikel-breadcrumb-current]').text()).toBe(
      'Teknik Pomodoro: Belajar 25 Minit, Rehat...',
    )
    expect(w.get('[data-testid=artikel-chip-category]').text()).toBe('Tips Belajar')
    expect(w.get('[data-testid=artikel-chip-level]').text()).toBe('Darjah 4')
    expect(w.get('[data-testid=artikel-chip-featured]').text()).toBe('Pilihan')
    expect(w.get('[data-testid=artikel-title]').text()).toBe(DETAIL.title)
    expect(w.get('[data-testid=artikel-author-name]').text()).toBe('Admin Demo')
    expect(w.get('[data-testid=artikel-published]').text()).toBe('24 Dec 2025')
    expect(w.get('[data-testid=artikel-views]').text()).toBe('597')
    expect(w.get('[data-testid=artikel-likes]').text()).toBe('6')
    expect(w.text()).toContain('Pembaca')
    expect(w.text()).toContain('Suka')
    expect(w.findAll('button').filter((b) => b.text().includes('Suka'))).toHaveLength(0)
    const body = w.get('[data-testid=artikel-body]')
    expect(body.get('h2').text()).toBe('Apa Itu Teknik Pomodoro?')
    expect(body.findAll('ol li')).toHaveLength(2)
    expect(body.html()).not.toContain('script')
    expect(body.html()).not.toContain('onerror')
  })

  it('renders related cards and the aside with the five latest', async () => {
    const w = await mountAt('/artikel/teknik-pomodoro', ArtikelDetailPage)
    expect(w.findAll('[data-testid=artikel-related-card]')).toHaveLength(3)
    expect(w.findAll('[data-testid=artikel-aside-item]')).toHaveLength(2)
    expect(w.get('[data-testid=artikel-aside-all]').attributes('href')).toBe('/artikel')
    expect(api.fetchLatestArticles).toHaveBeenCalledWith(5, expect.anything())
  })

  it('guest: no breadcrumb, no aside, no latest request', async () => {
    session.loggedIn = false
    const w = await mountAt('/artikel/teknik-pomodoro', ArtikelDetailPage)
    expect(w.find('[data-testid=artikel-breadcrumb]').exists()).toBe(false)
    expect(w.find('[data-testid=artikel-aside]').exists()).toBe(false)
    expect(api.fetchLatestArticles).not.toHaveBeenCalled()
    expect(w.find('[data-testid=artikel-title]').exists()).toBe(true)
  })

  it('share links and copy confirmation for 2 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = await mountAt('/artikel/teknik-pomodoro', ArtikelDetailPage)
    const url = window.location.href
    const title = encodeURIComponent(DETAIL.title)
    expect(w.get('[data-testid=share-whatsapp]').attributes('href')).toBe(
      `https://wa.me/?text=${encodeURIComponent(`${DETAIL.title} ${url}`)}`,
    )
    expect(w.get('[data-testid=share-facebook]').attributes('href')).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    )
    expect(w.get('[data-testid=share-twitter]').attributes('href')).toBe(
      `https://twitter.com/intent/tweet?text=${title}&url=${encodeURIComponent(url)}`,
    )
    await w.get('[data-testid=share-copy]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(url)
    expect(w.get('[data-testid=share-copied]').text()).toBe('Link Disalin!')
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(w.find('[data-testid=share-copied]').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('an unknown slug raises the in-place 404', async () => {
    api.fetchArticle.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await mountAt('/artikel/tiada-slug-zzz', ArtikelDetailPage)
    expect(useRouteOutcome().value).toBe(404)
  })

  it('moving in-app from an unknown slug to a valid one clears the 404 and shows the article', async () => {
    api.fetchArticle.mockImplementation((slug: string) =>
      slug === 'tiada-slug-zzz'
        ? Promise.reject(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
        : Promise.resolve(DETAIL),
    )
    const w = await mountAt('/artikel/tiada-slug-zzz', ArtikelDetailPage)
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-testid=artikel-title]').exists()).toBe(false)
    await w.setProps({ slug: 'teknik-pomodoro' })
    await flushPromises()
    expect(useRouteOutcome().value).toBeNull()
    expect(w.get('[data-testid=artikel-title]').text()).toBe(DETAIL.title)
  })
})
