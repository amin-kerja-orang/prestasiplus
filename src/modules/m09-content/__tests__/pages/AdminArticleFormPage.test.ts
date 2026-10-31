// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { AdminArticleDetail } from '../../api/admin-articles-notes'
import AdminArticleFormPage from '../../pages/AdminArticleFormPage.vue'

const api = vi.hoisted(() => ({
  fetchAdminArticle: vi.fn(),
  createAdminArticle: vi.fn(),
  updateAdminArticle: vi.fn(),
}))
vi.mock('../../api/admin-articles-notes', () => api)

const ARTICLE: AdminArticleDetail = {
  id: 10,
  title: 'Teknik Pomodoro',
  slug: 'teknik-pomodoro',
  excerpt: 'Ringkas',
  content: '<h2>Apa Itu Teknik Pomodoro?</h2><p>Isi</p>',
  featuredImage: null,
  category: 'TIPS_BELAJAR',
  gradeLevel: 'DARJAH_4',
  isPublished: true,
  isFeatured: true,
  views: 596,
  author: { id: 1, name: 'Admin Demo' },
  publishedAt: '2025-12-24T10:00:00+08:00',
  createdAt: '2026-02-22T10:00:00+08:00',
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(mode: 'create' | 'edit', id = '10'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/articles', component: { template: '<div />' } },
      { path: '/form', component: AdminArticleFormPage },
    ],
  })
  await router.push('/form')
  wrapper = mount(AdminArticleFormPage, { props: { mode, id }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

function t(w: VueWrapper, id: string) {
  return w.get(`[data-testid=${id}]`)
}

function el<T extends Element>(w: VueWrapper, id: string): T {
  return t(w, id).element as unknown as T
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchAdminArticle.mockResolvedValue(ARTICLE)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('AdminArticleFormPage create (M09 S2)', () => {
  it('shows the labels, placeholders, required flags and defaults', async () => {
    const w = await render('create', '')
    expect(w.get('[data-ds=back-link]').text()).toBe('Kembali ke Senarai')
    expect(w.get('[data-ds=back-link]').attributes('href')).toBe('/admin/articles')
    const title = el<HTMLInputElement>(w, 'article-title')
    expect(title.required).toBe(true)
    expect(title.placeholder).toBe('cth: 10 Tips Belajar Matematik')
    const excerpt = el<HTMLTextAreaElement>(w, 'article-excerpt')
    expect(excerpt.rows).toBe(3)
    expect(excerpt.placeholder).toBe('Ringkasan artikel')
    const content = el<HTMLTextAreaElement>(w, 'article-content')
    expect(content.tagName).toBe('TEXTAREA')
    expect(content.rows).toBe(15)
    expect(content.required).toBe(true)
    expect(content.placeholder).toBe('Tulis kandungan artikel di sini...')
    const image = el<HTMLInputElement>(w, 'article-image')
    expect(image.type).toBe('url')
    expect(image.placeholder).toBe('https://example.com/image.jpg')
    const category = el<HTMLSelectElement>(w, 'article-category')
    expect(category.required).toBe(true)
    expect([...category.options].map((o) => o.text)[0]).toBe('Pilih kategori')
    expect(category.options).toHaveLength(8)
    expect(el<HTMLSelectElement>(w, 'article-grade').value).toBe('SEMUA')
    expect(t(w, 'article-published').attributes('aria-checked')).toBe('false')
    expect(t(w, 'article-featured').attributes('aria-checked')).toBe('false')
    expect(w.text()).toContain('Terbitkan Sekarang')
    expect(w.text()).toContain('Artikel Featured')
    expect(t(w, 'form-submit').text()).toBe('Simpan Artikel')
    expect(t(w, 'form-cancel').text()).toBe('Batal')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/admin/articles')
    expect(t(w, 'admin-article-form').attributes('novalidate')).toBeUndefined()
  })

  it('is invalid until title, content and category are filled (native validation)', async () => {
    const w = await render('create', '')
    const form = el<HTMLFormElement>(w, 'admin-article-form')
    expect(form.checkValidity()).toBe(false)
    await t(w, 'article-title').setValue('Tajuk')
    await t(w, 'article-content').setValue('<p>Isi</p>')
    expect(el<HTMLSelectElement>(w, 'article-category').validity.valueMissing).toBe(true)
    await t(w, 'article-category').setValue('BERITA')
    expect(form.checkValidity()).toBe(true)
  })

  it('posts the body, queues the flash and returns to the list', async () => {
    api.createAdminArticle.mockResolvedValue({ data: ARTICLE, status: 'Artikel berjaya ditambah.' })
    const w = await render('create', '')
    await t(w, 'article-title').setValue('Tajuk Baru')
    await t(w, 'article-content').setValue('<h2>Tajuk</h2><p>Isi</p>')
    await t(w, 'article-category').setValue('BERITA')
    await t(w, 'article-published').trigger('click')
    await t(w, 'admin-article-form').trigger('submit')
    await flushPromises()
    expect(api.createAdminArticle).toHaveBeenCalledWith({
      title: 'Tajuk Baru',
      excerpt: null,
      content: '<h2>Tajuk</h2><p>Isi</p>',
      featuredImage: null,
      category: 'BERITA',
      gradeLevel: 'SEMUA',
      isPublished: true,
      isFeatured: false,
    })
    expect(router.currentRoute.value.path).toBe('/admin/articles')
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Artikel berjaya ditambah.',
    })
  })

  it('shows 422 field messages under the fields and keeps the input', async () => {
    api.createAdminArticle.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Invalid',
        fields: { title: 'Medan ini tidak sah.' },
      }),
    )
    const w = await render('create', '')
    await t(w, 'article-title').setValue('X')
    await t(w, 'article-content').setValue('Y')
    await t(w, 'article-category').setValue('UMUM')
    await t(w, 'admin-article-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'field-error').text()).toBe('Medan ini tidak sah.')
    expect(router.currentRoute.value.path).toBe('/form')
    expect(el<HTMLInputElement>(w, 'article-title').value).toBe('X')
  })
})

describe('AdminArticleFormPage edit (M09 S3)', () => {
  it('pre-fills the stored values, has no category placeholder and is valid as loaded', async () => {
    const w = await render('edit')
    expect(api.fetchAdminArticle).toHaveBeenCalledWith(10, expect.anything())
    expect(el<HTMLInputElement>(w, 'article-title').value).toBe('Teknik Pomodoro')
    expect(el<HTMLTextAreaElement>(w, 'article-content').value).toBe(ARTICLE.content)
    const category = el<HTMLSelectElement>(w, 'article-category')
    expect(category.value).toBe('TIPS_BELAJAR')
    expect(category.options).toHaveLength(7)
    expect(el<HTMLSelectElement>(w, 'article-grade').value).toBe('SEMUA')
    expect(t(w, 'article-published').attributes('aria-checked')).toBe('true')
    expect(t(w, 'article-featured').attributes('aria-checked')).toBe('true')
    expect(el<HTMLFormElement>(w, 'admin-article-form').checkValidity()).toBe(true)
    expect(t(w, 'form-submit').text()).toBe('Kemaskini Artikel')
  })

  it('PUTs the changes and returns to the list with the flash', async () => {
    api.updateAdminArticle.mockResolvedValue({
      data: ARTICLE,
      status: 'Artikel berjaya dikemaskini.',
    })
    const w = await render('edit')
    await t(w, 'article-featured').trigger('click')
    await t(w, 'admin-article-form').trigger('submit')
    await flushPromises()
    expect(api.updateAdminArticle).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ isFeatured: false, isPublished: true, excerpt: 'Ringkas' }),
    )
    expect(router.currentRoute.value.path).toBe('/admin/articles')
    expect(useFlashStore().pending?.type).toBe('success')
  })

  it('goes back to the list with "Artikel tidak dijumpai." for an unknown id', async () => {
    api.fetchAdminArticle.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    await render('edit', '9999')
    expect(router.currentRoute.value.path).toBe('/admin/articles')
    expect(useFlashStore().pending).toEqual({
      type: 'error',
      message: 'Artikel tidak dijumpai.',
    })
  })

  it('treats a non-numeric id ("categories") as not found without calling the API', async () => {
    await render('edit', 'categories')
    expect(api.fetchAdminArticle).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/admin/articles')
    expect(useFlashStore().pending?.message).toBe('Artikel tidak dijumpai.')
  })

  it('shows the load error box for another failure', async () => {
    api.fetchAdminArticle.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render('edit')
    expect(t(w, 'admin-article-load-error').text()).toContain(
      'Ralat memuatkan data. Sila cuba semula.',
    )
    expect(w.find('[data-testid=admin-article-form]').exists()).toBe(false)
  })
})
