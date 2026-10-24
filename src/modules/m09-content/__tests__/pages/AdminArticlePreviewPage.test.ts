// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { usePageMeta } from '@/composables'
import { useFlashStore } from '@/stores/flash'

import type { AdminArticleDetail } from '../../api/admin-articles-notes'
import AdminArticlePreviewPage from '../../pages/AdminArticlePreviewPage.vue'

const api = vi.hoisted(() => ({ fetchAdminArticle: vi.fn() }))
vi.mock('../../api/admin-articles-notes', () => api)

const BODY = '<h2>Apa Itu Teknik Pomodoro?</h2><p>' + 'x'.repeat(300) + '</p>'

const ARTICLE: AdminArticleDetail = {
  id: 10,
  title: 'Teknik Pomodoro',
  slug: 'teknik-pomodoro',
  excerpt: 'Ringkas',
  content: BODY,
  featuredImage: null,
  category: 'TIPS_BELAJAR',
  gradeLevel: 'DARJAH_4',
  isPublished: true,
  isFeatured: true,
  views: 596,
  author: { id: 1, name: 'Admin Demo' },
  publishedAt: null,
  createdAt: '2026-02-22T10:00:00+08:00',
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(id = '10'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/articles', component: { template: '<div />' } },
      { path: '/preview', component: AdminArticlePreviewPage },
    ],
  })
  await router.push('/preview')
  wrapper = mount(AdminArticlePreviewPage, { props: { id }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

function t(w: VueWrapper, id: string) {
  return w.get(`[data-testid=${id}]`)
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchAdminArticle.mockReset()
  api.fetchAdminArticle.mockResolvedValue(ARTICLE)
  usePageMeta().reset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('AdminArticlePreviewPage (M09 S4)', () => {
  it('shows the meta, the pills, the excerpt and the edit link', async () => {
    const w = await render()
    expect(t(w, 'preview-title').text()).toBe('Teknik Pomodoro')
    expect(t(w, 'preview-author').text()).toBe('Admin Demo')
    expect(t(w, 'preview-date').text()).toBe('22 Feb 2026')
    expect(t(w, 'preview-views').text()).toBe('596 tontonan')
    expect(t(w, 'status-pill').text()).toBe('Diterbitkan')
    expect(t(w, 'preview-featured').text()).toBe('Pilihan')
    expect(t(w, 'preview-excerpt').text()).toBe('Ringkas')
    expect(t(w, 'preview-edit').text()).toBe('Edit Artikel')
    expect(t(w, 'preview-edit').attributes('href')).toBe('/admin/articles/10/edit')
    expect(w.get('[data-ds=back-link]').attributes('href')).toBe('/admin/articles')
  })

  it('omits the Featured pill for a non-featured article', async () => {
    api.fetchAdminArticle.mockResolvedValue({ ...ARTICLE, isFeatured: false })
    const w = await render()
    expect(w.find('[data-testid=preview-featured]').exists()).toBe(false)
  })

  it('prints the stored body as escaped text (never rendered) and wraps it', async () => {
    const w = await render()
    const body = t(w, 'preview-body')
    expect(body.text().startsWith('<h2>Apa Itu Teknik Pomodoro?</h2><p>')).toBe(true)
    expect(body.find('h2').exists()).toBe(false)
    expect(body.classes().join(' ')).toContain('break-words')
  })

  it('sets the shell header to the title / "Paparan artikel"', async () => {
    await render()
    expect(usePageMeta().state.header).toEqual({
      title: 'Teknik Pomodoro',
      subtitle: 'Paparan artikel',
    })
  })

  it('goes back to the list with the flash for an unknown id', async () => {
    api.fetchAdminArticle.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    await render('9999')
    expect(router.currentRoute.value.path).toBe('/admin/articles')
    expect(useFlashStore().pending).toEqual({ type: 'error', message: 'Artikel tidak dijumpai.' })
  })

  it('treats "categories" as an unknown id without an API call', async () => {
    await render('categories')
    expect(api.fetchAdminArticle).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/admin/articles')
    expect(useFlashStore().pending?.message).toBe('Artikel tidak dijumpai.')
  })
})
