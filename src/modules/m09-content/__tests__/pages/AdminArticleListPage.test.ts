// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { useFlashStore } from '@/stores/flash'

import type { AdminArticleItem } from '../../api/admin-articles-notes'
import AdminArticleListPage from '../../pages/AdminArticleListPage.vue'
import { chooseRowAction, menuItem, openRowMenu } from '../menu'

const api = vi.hoisted(() => ({
  fetchAdminArticles: vi.fn(),
  deleteAdminArticle: vi.fn(),
}))
vi.mock('../../api/admin-articles-notes', () => api)

function article(id: number, extra: Partial<AdminArticleItem> = {}): AdminArticleItem {
  return {
    id,
    title: `Artikel ${String(id)}`,
    category: 'TIPS_BELAJAR',
    categoryLabel: 'Tips Belajar',
    gradeLevel: 'TINGKATAN_4',
    isPublished: true,
    isFeatured: false,
    views: 596,
    createdAt: '2026-02-22T10:00:00+08:00',
    author: { id: 1, name: 'Admin Demo' },
    ...extra,
  }
}

function listResult(rows: AdminArticleItem[], total = rows.length, pageSize = 20) {
  return {
    data: rows,
    meta: {
      page: 1,
      pageSize,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      from: rows.length ? 1 : null,
      to: rows.length || null,
    },
  }
}

let wrapper: VueWrapper | null = null
let router: Router
let confirmSpy: ReturnType<typeof vi.spyOn>

async function render(url = '/admin/articles'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/articles', name: 'm09.admin.articles.list', component: AdminArticleListPage },
      {
        path: '/admin/articles/create',
        name: 'm09.admin.articles.create',
        component: { template: '<i/>' },
      },
      { path: '/admin/articles/:id', component: { template: '<i/>' } },
      { path: '/admin/articles/:id/edit', component: { template: '<i/>' } },
    ],
  })
  await router.push(url)
  wrapper = mount(AdminArticleListPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

function t(w: VueWrapper, id: string) {
  return w.get(`[data-testid=${id}]`)
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  api.fetchAdminArticles.mockResolvedValue(
    listResult([
      article(10, { isFeatured: true }),
      article(11, {
        title: 'A'.repeat(60),
        isPublished: false,
        category: 'BERITA',
        categoryLabel: 'Berita',
        gradeLevel: 'SEMUA',
      }),
    ]),
  )
})

afterEach(() => {
  confirmSpy.mockRestore()
  wrapper?.unmount()
  wrapper = null
})

describe('AdminArticleListPage (M09 S1)', () => {
  it('shows the count, the add link and the headers', async () => {
    const w = await render()
    expect(t(w, 'admin-articles-count').text()).toBe('Jumlah: 2 artikel')
    expect(t(w, 'admin-articles-add').text()).toBe('Tambah')
    expect(t(w, 'admin-articles-add').attributes('href')).toBe('/admin/articles/create')
    expect(w.findAll('thead th').map((h) => h.text())).toEqual([
      'Tajuk',
      'Kategori',
      'Tahap',
      'Status',
      'Views',
      'Tarikh',
      'Tindakan',
    ])
  })

  it('renders the row cells: star, title cut at 50, author, raw level, status, date', async () => {
    const w = await render()
    const rows = w.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    const first = rows[0]!
    expect(first.find('[data-testid=article-featured]').attributes('title')).toBe('Featured')
    expect(first.find('[data-testid=admin-article-row]').attributes('data-article-id')).toBe('10')
    expect(first.find('[data-testid=article-title]').text()).toBe('Artikel 10')
    expect(first.find('[data-testid=article-author]').text()).toBe('Oleh: Admin Demo')
    expect(first.find('[data-testid=article-category]').text()).toBe('Tips Belajar')
    expect(first.find('[data-testid=article-grade]').text()).toBe('TINGKATAN_4')
    expect(first.find('[data-testid=status-pill]').text()).toBe('Diterbitkan')
    expect(first.find('[data-testid=article-views]').text()).toBe('596')
    expect(first.find('[data-testid=article-date]').text()).toBe('22/02/2026')
    const second = rows[1]!
    expect(second.find('[data-testid=article-featured]').exists()).toBe(false)
    expect(second.find('[data-testid=article-title]').text()).toBe(`${'A'.repeat(50)}...`)
    expect(second.find('[data-testid=status-pill]').text()).toBe('Draf')
  })

  it('links the row actions in the row menu', async () => {
    const w = await render()
    const items = await openRowMenu(w, 0)
    expect(w.find('a[href="/admin/articles/10/edit"]').exists()).toBe(true)
    expect(menuItem(items, 'Lihat')?.getAttribute('href')).toBe('/admin/articles/10')
    expect(menuItem(items, 'Padam')).toBeDefined()
  })

  it('has the filter controls and no pager for one page', async () => {
    const w = await render()
    expect(t(w, 'admin-articles-search').attributes('placeholder')).toBe('Cari artikel...')
    const categories = w
      .findAll('[data-testid=admin-articles-category] option')
      .map((o) => o.text())
    expect(categories[0]).toBe('Semua Kategori')
    expect(categories).toHaveLength(8)
    expect(w.findAll('[data-testid=admin-articles-published] option').map((o) => o.text())).toEqual(
      ['Semua Status', 'Diterbitkan', 'Draf'],
    )
    expect(w.find('nav[aria-label="Pagination Navigation"]').exists()).toBe(false)
  })

  it('initialises the controls from the URL and queries with the filters', async () => {
    const w = await render('/admin/articles?category=MOTIVASI&search=sifir&published=1&page=2')
    expect((t(w, 'admin-articles-category').element as HTMLSelectElement).value).toBe('MOTIVASI')
    expect((t(w, 'admin-articles-search').element as HTMLInputElement).value).toBe('sifir')
    expect((t(w, 'admin-articles-published').element as HTMLSelectElement).value).toBe('1')
    expect(api.fetchAdminArticles).toHaveBeenCalledWith(
      { search: 'sifir', category: 'MOTIVASI', published: '1', page: 2 },
      expect.anything(),
    )
  })

  it('submits the form by navigating to the query (no auto-submit)', async () => {
    const w = await render()
    await t(w, 'admin-articles-category').setValue('MOTIVASI')
    expect(router.currentRoute.value.fullPath).toBe('/admin/articles')
    await t(w, 'admin-articles-filter').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ category: 'MOTIVASI' })
  })

  it('keeps the filters on every pager link (DV-M09-03)', async () => {
    api.fetchAdminArticles.mockResolvedValue(listResult([article(1)], 21))
    const w = await render('/admin/articles?category=TIPS_BELAJAR')
    const next = w.findAll('button').find((b) => b.text() === '2')
    expect(next).toBeDefined()
    await next!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ category: 'TIPS_BELAJAR', page: '2' })
  })

  it('shows the empty row and "Jumlah: 0 artikel"', async () => {
    api.fetchAdminArticles.mockResolvedValue(listResult([]))
    const w = await render('/admin/articles?search=zzzqqq')
    expect(t(w, 'admin-articles-empty').text()).toContain('Tiada artikel dijumpai.')
    expect(t(w, 'admin-articles-count').text()).toBe('Jumlah: 0 artikel')
    expect(w.find('nav[aria-label="Pagination Navigation"]').exists()).toBe(false)
  })

  it('does nothing when the delete confirm is cancelled', async () => {
    confirmSpy.mockReturnValue(false)
    const w = await render()
    await chooseRowAction(w, 0, 'Padam')
    expect(confirmSpy).toHaveBeenCalledWith('Adakah anda pasti mahu padam artikel ini?')
    expect(api.deleteAdminArticle).not.toHaveBeenCalled()
  })

  it('deletes, reloads and shows the success flash', async () => {
    api.deleteAdminArticle.mockResolvedValue({
      data: { deleted: 1 },
      status: 'Artikel berjaya dipadam.',
    })
    const w = await render()
    await chooseRowAction(w, 0, 'Padam')
    expect(api.deleteAdminArticle).toHaveBeenCalledWith(10)
    expect(api.fetchAdminArticles).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Artikel berjaya dipadam.',
    })
  })

  it('shows a load error box instead of the table', async () => {
    api.fetchAdminArticles.mockRejectedValue(new Error('boom'))
    const w = await render()
    expect(w.find('[data-testid=admin-articles-error]').exists()).toBe(true)
    expect(w.find('[data-testid=admin-articles-table]').exists()).toBe(false)
  })
})
