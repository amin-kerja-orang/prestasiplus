// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import ChapterCreatePage from '../../pages/ChapterCreatePage.vue'
import ChapterEditPage from '../../pages/ChapterEditPage.vue'
import CurriculumBrowserPage from '../../pages/CurriculumBrowserPage.vue'
import TopicCreatePage from '../../pages/TopicCreatePage.vue'
import TopicEditPage from '../../pages/TopicEditPage.vue'
import {
  chapter,
  chapterDetail,
  LEVELS,
  list,
  subtopic,
  SUBJECTS,
  topic,
  tree,
} from './t3-fixtures'

const api = vi.hoisted(() => ({
  fetchSubjectOptions: vi.fn(),
  fetchLevelOptions: vi.fn(),
  fetchCurriculumTree: vi.fn(),
  fetchChapter: vi.fn(),
  fetchTopic: vi.fn(),
  createChapter: vi.fn(),
  updateChapter: vi.fn(),
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
  deleteChapter: vi.fn(),
  deleteTopic: vi.fn(),
  deleteSubtopic: vi.fn(),
  createSubtopic: vi.fn(),
  updateSubtopic: vi.fn(),
}))
vi.mock('../../api/admin-curriculum', () => api)

const dialogs = vi.hoisted(() => ({ confirmNative: vi.fn() }))
vi.mock('@/components/overlay/native-dialogs', () => dialogs)

let wrapper: VueWrapper | null = null
const scrollTo = vi.fn()
const STUB = { template: '<div />' }

async function render(
  component: object,
  path: string,
  url: string,
  props: Record<string, unknown> = {},
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes:
      path === '/admin/curriculum'
        ? [{ path, component }]
        : [
            { path, component },
            { path: '/admin/curriculum', component: STUB },
          ],
  })
  await router.push(url)
  wrapper = mount(component, { props, attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return { w: wrapper, router }
}

const BOOM = new Error('boom')
const invalid = new ApiError({
  status: 422,
  code: 'VALIDATION_ERROR',
  message: 'x',
  fields: { name: 'The name field is required.' },
})
const topicDetail = {
  id: 126,
  chapterId: 91,
  name: 'Fungsi',
  nameEn: null,
  topicNumber: '1',
  description: null,
  learningStandard: null,
  isActive: true,
  createdSeq: 1,
  chapter: chapterDetail(),
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  scrollTo.mockReset()
  dialogs.confirmNative.mockReset()
  api.fetchSubjectOptions.mockResolvedValue(list(SUBJECTS))
  api.fetchLevelOptions.mockResolvedValue(list(LEVELS))
  window.scrollTo = scrollTo
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('S2-S5 load failure and server rejection', () => {
  it('S2 shows the load-error box and no form when the options fail', async () => {
    api.fetchSubjectOptions.mockRejectedValue(BOOM)
    const { w } = await render(
      ChapterCreatePage,
      '/admin/curriculum/chapters/create',
      '/admin/curriculum/chapters/create',
    )
    expect(w.get('[data-testid=curriculum-load-error]').text()).toContain('Ralat memuatkan data.')
    expect(w.find('[data-testid=chapter-form]').exists()).toBe(false)
  })

  it('S3 shows the load-error box when the chapter fails with a non-404', async () => {
    api.fetchChapter.mockRejectedValue(BOOM)
    const { w } = await render(
      ChapterEditPage,
      '/admin/curriculum/chapters/:id/edit',
      '/admin/curriculum/chapters/91/edit',
      { id: '91' },
    )
    expect(w.find('[data-testid=curriculum-load-error]').exists()).toBe(true)
    expect(w.find('[data-testid=chapter-form]').exists()).toBe(false)
    expect(useFlashStore().pending).toBeNull()
  })

  it('S4 shows the load-error box when the chapter fails with a non-404', async () => {
    api.fetchChapter.mockRejectedValue(BOOM)
    const { w } = await render(
      TopicCreatePage,
      '/admin/curriculum/topics/create',
      '/admin/curriculum/topics/create?chapter_id=91',
    )
    expect(w.find('[data-testid=curriculum-load-error]').exists()).toBe(true)
    expect(w.find('[data-testid=topic-form]').exists()).toBe(false)
  })

  it('S5 shows the load-error box when the topic fails with a non-404', async () => {
    api.fetchTopic.mockRejectedValue(BOOM)
    const { w } = await render(
      TopicEditPage,
      '/admin/curriculum/topics/:id/edit',
      '/admin/curriculum/topics/126/edit',
      { id: '126' },
    )
    expect(w.find('[data-testid=curriculum-load-error]').exists()).toBe(true)
    expect(w.find('[data-testid=topic-form]').exists()).toBe(false)
  })

  it('S3 keeps the input and shows the red box on a 422', async () => {
    api.fetchChapter.mockResolvedValue(chapterDetail())
    api.updateChapter.mockRejectedValue(invalid)
    const { w, router } = await render(
      ChapterEditPage,
      '/admin/curriculum/chapters/:id/edit',
      '/admin/curriculum/chapters/91/edit',
      { id: '91' },
    )
    await w.get('[data-testid=chapter-name]').setValue('Baru')
    await w.get('[data-testid=chapter-form]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=curriculum-form-alert]').text()).toContain(
      'The name field is required.',
    )
    expect((w.get('[data-testid=chapter-name]').element as HTMLInputElement).value).toBe('Baru')
    expect(router.currentRoute.value.path).toBe('/admin/curriculum/chapters/91/edit')
  })

  it('S4 keeps the input and shows the red box on a 422', async () => {
    api.fetchChapter.mockResolvedValue(chapterDetail())
    api.createTopic.mockRejectedValue(invalid)
    const { w, router } = await render(
      TopicCreatePage,
      '/admin/curriculum/topics/create',
      '/admin/curriculum/topics/create?chapter_id=91',
    )
    await w.get('[data-testid=topic-name]').setValue('Baru')
    await w.get('[data-testid=topic-form]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=curriculum-form-alert]').text()).toContain(
      'The name field is required.',
    )
    expect((w.get('[data-testid=topic-name]').element as HTMLInputElement).value).toBe('Baru')
    expect(router.currentRoute.value.path).toBe('/admin/curriculum/topics/create')
  })

  it('S5 keeps the input and shows the red box on a 422', async () => {
    api.fetchTopic.mockResolvedValue(topicDetail)
    api.updateTopic.mockRejectedValue(invalid)
    const { w, router } = await render(
      TopicEditPage,
      '/admin/curriculum/topics/:id/edit',
      '/admin/curriculum/topics/126/edit',
      { id: '126' },
    )
    await w.get('[data-testid=topic-name]').setValue('Baru')
    await w.get('[data-testid=topic-form]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=curriculum-form-alert]').text()).toContain(
      'The name field is required.',
    )
    expect((w.get('[data-testid=topic-name]').element as HTMLInputElement).value).toBe('Baru')
    expect(router.currentRoute.value.path).toBe('/admin/curriculum/topics/126/edit')
  })

  it('S3 loads the new chapter when the id changes', async () => {
    api.fetchChapter.mockResolvedValue(chapterDetail())
    const { w } = await render(
      ChapterEditPage,
      '/admin/curriculum/chapters/:id/edit',
      '/admin/curriculum/chapters/91/edit',
      { id: '91' },
    )
    api.fetchChapter.mockResolvedValue(chapterDetail({ id: 92, name: 'Asas Nombor' }))
    await w.setProps({ id: '92' })
    await flushPromises()
    expect(api.fetchChapter).toHaveBeenLastCalledWith('92', expect.anything())
    expect((w.get('[data-testid=chapter-name]').element as HTMLInputElement).value).toBe(
      'Asas Nombor',
    )
  })
})

describe('S1 mutation guards and flashes', () => {
  const URL = '/admin/curriculum?subject_id=3&education_level_id=10'

  beforeEach(() => {
    api.fetchCurriculumTree.mockResolvedValue(
      tree([chapter(1, { topics: [topic(10, 1, { subtopics: [subtopic(100, 10, 'Sub A')] })] })]),
    )
  })

  it('same-URL filter reload clears a visible flash', async () => {
    const { w } = await render(CurriculumBrowserPage, '/admin/curriculum', URL)
    useFlashStore().show({ type: 'error', message: 'Lama' })
    await w.get('[data-testid=curriculum-filter]').trigger('submit')
    await flushPromises()
    expect(api.fetchCurriculumTree).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current).toBeNull()
  })

  it('ignores a second delete while one is in flight (no confirm, no request)', async () => {
    let finish: (v: unknown) => void = () => undefined
    api.deleteChapter.mockReturnValue(new Promise((r) => (finish = r)))
    dialogs.confirmNative.mockReturnValue(true)
    const { w } = await render(CurriculumBrowserPage, '/admin/curriculum', URL)
    await w.get('[data-testid=chapter-delete]').trigger('click')
    await w.get('[data-testid=topic-delete]').trigger('click')
    expect(dialogs.confirmNative).toHaveBeenCalledTimes(1)
    expect(api.deleteTopic).not.toHaveBeenCalled()
    finish({ data: {}, status: 'Bab berjaya dipadam.' })
    await flushPromises()
  })

  it('shows no success flash when the reload after a mutation fails', async () => {
    api.deleteChapter.mockResolvedValue({ data: {}, status: 'Bab berjaya dipadam.' })
    dialogs.confirmNative.mockReturnValue(true)
    const { w } = await render(CurriculumBrowserPage, '/admin/curriculum', URL)
    api.fetchCurriculumTree.mockRejectedValue(BOOM)
    await w.get('[data-testid=chapter-delete]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=curriculum-load-error]').exists()).toBe(true)
    expect(useFlashStore().current).toBeNull()
  })

  it('a failed delete flashes the error, scrolls to the top and reloads on a 404', async () => {
    api.deleteChapter.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Bab tidak dijumpai.' }),
    )
    dialogs.confirmNative.mockReturnValue(true)
    const { w } = await render(CurriculumBrowserPage, '/admin/curriculum', URL)
    await w.get('[data-testid=chapter-delete]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current).toEqual({ type: 'error', message: ['Bab tidak dijumpai.'] })
    expect(scrollTo).toHaveBeenCalled()
    expect(api.fetchCurriculumTree).toHaveBeenCalledTimes(2)
  })

  it('a failed inline add flashes the error and scrolls to the top', async () => {
    api.createSubtopic.mockRejectedValue(invalid)
    const { w } = await render(CurriculumBrowserPage, '/admin/curriculum', URL)
    await w.get('[data-testid=topic-toggle]').trigger('click')
    await w.get('[data-testid=subtopic-add-toggle]').trigger('click')
    await w.get('[data-testid=subtopic-add-name]').setValue('X')
    await w.get('[data-testid=subtopic-add-form]').trigger('submit')
    await flushPromises()
    expect(useFlashStore().current?.type).toBe('error')
    expect(scrollTo).toHaveBeenCalled()
    expect((w.get('[data-testid=subtopic-add-name]').element as HTMLInputElement).value).toBe('X')
  })

  it('a failed inline save flashes the error and scrolls to the top', async () => {
    api.updateSubtopic.mockRejectedValue(invalid)
    const { w } = await render(CurriculumBrowserPage, '/admin/curriculum', URL)
    await w.get('[data-testid=topic-toggle]').trigger('click')
    await w.get('[data-testid=subtopic-edit]').trigger('click')
    await w.get('[data-testid=subtopic-edit-form]').trigger('submit')
    await flushPromises()
    expect(useFlashStore().current?.type).toBe('error')
    expect(scrollTo).toHaveBeenCalled()
  })
})
