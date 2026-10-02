// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import TopicCreatePage from '../../pages/TopicCreatePage.vue'
import TopicEditPage from '../../pages/TopicEditPage.vue'
import { chapterDetail } from './t3-fixtures'

const api = vi.hoisted(() => ({
  fetchChapter: vi.fn(),
  fetchTopic: vi.fn(),
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
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
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function val(w: VueWrapper, testid: string): string {
  return (w.get(`[data-testid=${testid}]`).element as HTMLInputElement).value
}

const NOT_FOUND = new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' })

describe('TopicCreatePage (M03 S4)', () => {
  const URL = '/admin/curriculum/topics/create'

  it('shows the context card, the fields with the live copy and no "Aktif"', async () => {
    api.fetchChapter.mockResolvedValue(chapterDetail())
    const { w } = await render(TopicCreatePage, URL, `${URL}?chapter_id=91`)
    expect(api.fetchChapter).toHaveBeenCalledWith('91', expect.anything())
    const card = w.get('[data-testid=chapter-context]').text()
    expect(card).toContain('Bab 1: Fungsi dan Persamaan Kuadratik')
    expect(card).toContain('Matematik')
    expect(card).toContain('Tingkatan 4')
    expect(w.get('[data-testid=topic-name]').attributes('placeholder')).toBe(
      'cth: Nombor hingga 1000',
    )
    expect(w.get('[data-testid=topic-number]').attributes('placeholder')).toBe('cth: 1.1')
    const text = w.get('[data-testid=topic-form]').text()
    expect(text).toContain('Contoh: 1.1, 1.2, 2.1 (opsional)')
    expect(text).toContain('Rujuk dokumen standard kurikulum KPM')
    expect(w.find('[data-testid=topic-active]').exists()).toBe(false)
    expect(w.get('[data-testid=topic-submit]').text()).toBe('Simpan Topik')
    expect(w.get('[data-testid=curriculum-back]').attributes('href')).toBe(
      '/admin/curriculum?subject_id=3&education_level_id=10',
    )
  })

  it('posts the topic for the chapter and returns to the tree with the flash', async () => {
    api.fetchChapter.mockResolvedValue(chapterDetail())
    api.createTopic.mockResolvedValue({ data: {}, status: 'Topik berjaya ditambah.' })
    const { w, router } = await render(TopicCreatePage, URL, `${URL}?chapter_id=91`)
    await w.get('[data-testid=topic-name]').setValue('Topik Baru')
    await w.get('[data-testid=topic-number]').setValue('1.4')
    await w.get('[data-testid=topic-form]').trigger('submit')
    await flushPromises()
    expect(api.createTopic).toHaveBeenCalledWith({
      chapterId: 91,
      name: 'Topik Baru',
      nameEn: null,
      topicNumber: '1.4',
      description: null,
      learningStandard: null,
    })
    expect(router.currentRoute.value.fullPath).toBe(
      '/admin/curriculum?subject_id=3&education_level_id=10',
    )
    expect(useFlashStore().pending?.message).toBe('Topik berjaya ditambah.')
  })

  it('without chapter_id redirects with "Chapter ID diperlukan." and never fetches', async () => {
    const { router } = await render(TopicCreatePage, URL, URL)
    expect(api.fetchChapter).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/admin/curriculum')
    expect(useFlashStore().pending).toEqual({ type: 'error', message: 'Chapter ID diperlukan.' })
  })

  it('an unknown chapter redirects with "Bab tidak dijumpai."', async () => {
    api.fetchChapter.mockRejectedValue(NOT_FOUND)
    const { router } = await render(TopicCreatePage, URL, `${URL}?chapter_id=zzz`)
    expect(router.currentRoute.value.path).toBe('/admin/curriculum')
    expect(useFlashStore().pending).toEqual({ type: 'error', message: 'Bab tidak dijumpai.' })
  })
})

describe('TopicEditPage (M03 S5)', () => {
  const URL = '/admin/curriculum/topics/:id/edit'
  const topic = {
    id: 126,
    chapterId: 91,
    name: 'Fungsi',
    nameEn: 'Functions',
    topicNumber: '1',
    description: 'Konsep fungsi dan graf',
    learningStandard: null,
    isActive: true,
    createdSeq: 1,
    chapter: chapterDetail(),
  }

  it('fills the values, shows the context card, "Aktif" and no chapter select', async () => {
    api.fetchTopic.mockResolvedValue(topic)
    const { w } = await render(TopicEditPage, URL, '/admin/curriculum/topics/126/edit', {
      id: '126',
    })
    expect(val(w, 'topic-name')).toBe('Fungsi')
    expect(val(w, 'topic-name-en')).toBe('Functions')
    expect(val(w, 'topic-number')).toBe('1')
    expect(val(w, 'topic-description')).toBe('Konsep fungsi dan graf')
    expect(val(w, 'topic-standard')).toBe('')
    expect((w.get('[data-testid=topic-active]').element as HTMLInputElement).checked).toBe(true)
    expect(w.get('[data-testid=topic-form]').text()).toContain(
      'Nyahtanda jika topik ini tidak mahu dipaparkan buat masa ini',
    )
    expect(w.find('select').exists()).toBe(false)
    expect(w.get('[data-testid=chapter-context]').text()).toContain('Tingkatan 4')
    expect(w.get('[data-testid=topic-submit]').text()).toBe('Kemaskini Topik')
  })

  it('puts the topic with isActive and returns to the tree', async () => {
    api.fetchTopic.mockResolvedValue(topic)
    api.updateTopic.mockResolvedValue({ data: {}, status: 'Topik berjaya dikemaskini.' })
    const { w, router } = await render(TopicEditPage, URL, '/admin/curriculum/topics/126/edit', {
      id: '126',
    })
    await w.get('[data-testid=topic-active]').setValue(false)
    await w.get('[data-testid=topic-form]').trigger('submit')
    await flushPromises()
    expect(api.updateTopic).toHaveBeenCalledWith('126', {
      name: 'Fungsi',
      nameEn: 'Functions',
      topicNumber: '1',
      description: 'Konsep fungsi dan graf',
      learningStandard: null,
      isActive: false,
    })
    expect(router.currentRoute.value.fullPath).toBe(
      '/admin/curriculum?subject_id=3&education_level_id=10',
    )
    expect(useFlashStore().pending?.message).toBe('Topik berjaya dikemaskini.')
  })

  it('an unknown topic redirects with "Topik tidak dijumpai."', async () => {
    api.fetchTopic.mockRejectedValue(NOT_FOUND)
    const { router } = await render(TopicEditPage, URL, '/admin/curriculum/topics/zzz/edit', {
      id: 'zzz',
    })
    expect(router.currentRoute.value.path).toBe('/admin/curriculum')
    expect(useFlashStore().pending).toEqual({ type: 'error', message: 'Topik tidak dijumpai.' })
  })
})
