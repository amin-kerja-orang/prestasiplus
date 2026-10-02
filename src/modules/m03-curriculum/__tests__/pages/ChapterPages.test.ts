// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import ChapterCreatePage from '../../pages/ChapterCreatePage.vue'
import ChapterEditPage from '../../pages/ChapterEditPage.vue'
import { chapterDetail, LEVELS, list, SUBJECTS } from './t3-fixtures'

const api = vi.hoisted(() => ({
  fetchSubjectOptions: vi.fn(),
  fetchLevelOptions: vi.fn(),
  fetchChapter: vi.fn(),
  createChapter: vi.fn(),
  updateChapter: vi.fn(),
}))
vi.mock('../../api/admin-curriculum', () => api)

let wrapper: VueWrapper | null = null
const STUB = { template: '<div />' }

async function render(
  component: object,
  path: string,
  url: string,
  props: Record<string, unknown> = {},
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component },
      { path: '/admin/curriculum', component: STUB },
    ],
  })
  await router.push(url)
  wrapper = mount(component, { props, global: { plugins: [router] } })
  await flushPromises()
  return { w: wrapper, router }
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchSubjectOptions.mockResolvedValue(list(SUBJECTS))
  api.fetchLevelOptions.mockResolvedValue(list(LEVELS))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function val(w: VueWrapper, testid: string): string {
  return (w.get(`[data-testid=${testid}]`).element as HTMLInputElement).value
}

describe('ChapterCreatePage (M03 S2)', () => {
  const URL = '/admin/curriculum/chapters/create'

  it('pre-selects the pair from the query and lists the fields with the live copy', async () => {
    const { w } = await render(ChapterCreatePage, URL, `${URL}?subject_id=3&education_level_id=10`)
    expect(val(w, 'chapter-subject')).toBe('3')
    expect(val(w, 'chapter-level')).toBe('10')
    expect(w.get('[data-testid=chapter-name]').attributes('placeholder')).toBe('cth: Nombor Bulat')
    expect(w.get('[data-testid=chapter-name-en]').attributes('placeholder')).toBe(
      'e.g: Whole Numbers',
    )
    expect(w.get('[data-testid=chapter-number]').attributes('min')).toBe('1')
    expect(w.get('[data-testid=chapter-form]').text()).toContain('Contoh: 1, 2, 3 (opsional)')
    expect(w.get('[data-testid=chapter-description]').attributes('rows')).toBe('4')
    expect(w.find('[data-testid=chapter-active]').exists()).toBe(false)
    expect(w.get('[data-testid=chapter-submit]').text()).toBe('Simpan Bab')
    expect(w.get('[data-testid=chapter-cancel]').text()).toBe('Batal')
    for (const id of ['chapter-subject', 'chapter-level', 'chapter-name']) {
      expect(w.get(`[data-testid=${id}]`).attributes('required')).toBeDefined()
    }
  })

  it('back link and "Batal" carry exactly the parameters received', async () => {
    for (const [query, href] of [
      ['', '/admin/curriculum'],
      ['?subject_id=3', '/admin/curriculum?subject_id=3'],
      [
        '?subject_id=3&education_level_id=10',
        '/admin/curriculum?subject_id=3&education_level_id=10',
      ],
    ] as const) {
      const { w } = await render(ChapterCreatePage, URL, `${URL}${query}`)
      expect(w.get('[data-testid=curriculum-back]').attributes('href')).toBe(href)
      expect(w.get('[data-testid=chapter-cancel]').attributes('href')).toBe(href)
      w.unmount()
    }
  })

  it('creates the chapter, queues the flash and goes to the tree of the saved pair', async () => {
    api.createChapter.mockResolvedValue({ data: {}, status: 'Bab berjaya ditambah.' })
    const { w, router } = await render(ChapterCreatePage, URL, URL)
    await w.get('[data-testid=chapter-subject]').setValue('3')
    await w.get('[data-testid=chapter-level]').setValue('9')
    await w.get('[data-testid=chapter-name]').setValue('Bab 11 Demo')
    await w.get('[data-testid=chapter-number]').setValue('11')
    await w.get('[data-testid=chapter-form]').trigger('submit')
    await flushPromises()
    expect(api.createChapter).toHaveBeenCalledWith({
      subjectId: 3,
      educationLevelId: 9,
      name: 'Bab 11 Demo',
      nameEn: null,
      chapterNumber: 11,
      description: null,
    })
    expect(router.currentRoute.value.fullPath).toBe(
      '/admin/curriculum?subject_id=3&education_level_id=9',
    )
    expect(useFlashStore().pending).toEqual({ type: 'success', message: 'Bab berjaya ditambah.' })
  })

  it('stays on the form with the red box and keeps the input on a 422', async () => {
    api.createChapter.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { name: 'The name field is required.' },
      }),
    )
    const { w, router } = await render(ChapterCreatePage, URL, URL)
    await w.get('[data-testid=chapter-name]').setValue('Isi')
    await w.get('[data-testid=chapter-form]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=curriculum-form-alert]').text()).toContain(
      'The name field is required.',
    )
    expect(val(w, 'chapter-name')).toBe('Isi')
    expect(router.currentRoute.value.path).toBe(URL)
  })
})

describe('ChapterEditPage (M03 S3)', () => {
  const URL = '/admin/curriculum/chapters/:id/edit'

  it('fills the values, shows "Aktif" with its hint and links back to the current pair', async () => {
    api.fetchChapter.mockResolvedValue(chapterDetail())
    const { w } = await render(ChapterEditPage, URL, '/admin/curriculum/chapters/91/edit', {
      id: '91',
    })
    expect(api.fetchChapter).toHaveBeenCalledWith('91', expect.anything())
    expect(val(w, 'chapter-subject')).toBe('3')
    expect(val(w, 'chapter-level')).toBe('10')
    expect(val(w, 'chapter-name')).toBe('Fungsi dan Persamaan Kuadratik')
    expect(val(w, 'chapter-name-en')).toBe('Functions and Quadratic Equations')
    expect(val(w, 'chapter-number')).toBe('1')
    expect((w.get('[data-testid=chapter-active]').element as HTMLInputElement).checked).toBe(true)
    expect(w.get('[data-testid=chapter-form]').text()).toContain(
      'Nyahtanda jika bab ini tidak mahu dipaparkan buat masa ini',
    )
    expect(w.get('[data-testid=chapter-submit]').text()).toBe('Kemaskini Bab')
    expect(w.get('[data-testid=curriculum-back]').attributes('href')).toBe(
      '/admin/curriculum?subject_id=3&education_level_id=10',
    )
  })

  it('sends every field with isActive false when unticked and follows a changed pair', async () => {
    api.fetchChapter.mockResolvedValue(chapterDetail())
    api.updateChapter.mockResolvedValue({ data: {}, status: 'Bab berjaya dikemaskini.' })
    const { w, router } = await render(ChapterEditPage, URL, '/admin/curriculum/chapters/91/edit', {
      id: '91',
    })
    await w.get('[data-testid=chapter-active]').setValue(false)
    await w.get('[data-testid=chapter-level]').setValue('9')
    await w.get('[data-testid=chapter-form]').trigger('submit')
    await flushPromises()
    expect(api.updateChapter).toHaveBeenCalledWith('91', {
      subjectId: 3,
      educationLevelId: 9,
      name: 'Fungsi dan Persamaan Kuadratik',
      nameEn: 'Functions and Quadratic Equations',
      chapterNumber: 1,
      description: null,
      isActive: false,
    })
    expect(router.currentRoute.value.fullPath).toBe(
      '/admin/curriculum?subject_id=3&education_level_id=9',
    )
    expect(useFlashStore().pending?.message).toBe('Bab berjaya dikemaskini.')
  })

  it('an unknown chapter redirects to S1 with the one-time flash "Bab tidak dijumpai."', async () => {
    api.fetchChapter.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    const { router } = await render(ChapterEditPage, URL, '/admin/curriculum/chapters/zzz/edit', {
      id: 'zzz',
    })
    expect(router.currentRoute.value.path).toBe('/admin/curriculum')
    expect(useFlashStore().pending).toEqual({ type: 'error', message: 'Bab tidak dijumpai.' })
  })
})
