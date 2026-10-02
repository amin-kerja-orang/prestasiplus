// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useFlashStore } from '@/stores/flash'

import CurriculumBrowserPage from '../../pages/CurriculumBrowserPage.vue'
import { chapter, LEVELS, list, subtopic, SUBJECTS, topic, tree } from './t3-fixtures'

const api = vi.hoisted(() => ({
  fetchSubjectOptions: vi.fn(),
  fetchLevelOptions: vi.fn(),
  fetchCurriculumTree: vi.fn(),
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

const STUB = { template: '<div />' }

async function render(url = '/admin/curriculum?subject_id=3&education_level_id=10') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/curriculum', component: CurriculumBrowserPage },
      { path: '/admin/curriculum/:rest(.*)', component: STUB },
    ],
  })
  await router.push(url)
  wrapper = mount(CurriculumBrowserPage, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return { w: wrapper, router }
}

function sampleTree() {
  return tree([
    chapter(1, {
      description: 'Penerangan bab',
      topics: [
        topic(10, 1, { description: 'Penerangan topik', subtopics: [subtopic(100, 10, 'Sub A')] }),
        topic(11, 1, { topicNumber: null }),
      ],
    }),
    chapter(2, { chapterNumber: null }),
  ])
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  dialogs.confirmNative.mockReset()
  api.fetchSubjectOptions.mockResolvedValue(list(SUBJECTS))
  api.fetchLevelOptions.mockResolvedValue(list(LEVELS))
  api.fetchCurriculumTree.mockResolvedValue(sampleTree())
  window.scrollTo = vi.fn()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('CurriculumBrowserPage (M03 S1)', () => {
  it('shows only the prompt card without a pair and does not fetch the tree', async () => {
    const { w } = await render('/admin/curriculum?subject_id=3')
    expect(w.get('[data-testid=curriculum-prompt]').text()).toContain(
      'Sila pilih subjek dan tahap pendidikan',
    )
    expect(w.get('[data-testid=curriculum-prompt]').text()).toContain('Gunakan penapis di atas')
    expect(api.fetchCurriculumTree).not.toHaveBeenCalled()
    expect(w.find('[data-testid=curriculum-stats]').exists()).toBe(false)
    const subject = w.get('[data-testid=curriculum-subject]')
    expect(subject.findAll('option').map((o) => o.text())).toEqual([
      '-- Pilih Subjek --',
      'Bahasa Melayu',
      'Matematik',
    ])
    expect((subject.element as HTMLSelectElement).value).toBe('3')
    expect(w.get('[data-testid=curriculum-level]').findAll('option')[0]?.text()).toBe(
      '-- Pilih Tahap --',
    )
  })

  it('renders the cards, the "Tambah Bab" link and the tree', async () => {
    const { w } = await render()
    expect(api.fetchCurriculumTree).toHaveBeenCalledWith('3', '10', expect.anything())
    expect(w.get('[data-testid=stat-subject]').text()).toContain('Matematik')
    expect(w.get('[data-testid=stat-level]').text()).toContain('Tingkatan 4')
    expect(w.get('[data-testid=stat-chapters]').text()).toContain('2')
    expect(w.get('[data-testid=stat-topics]').text()).toContain('2 / 1')
    expect(w.get('[data-testid=chapter-add]').attributes('href')).toBe(
      '/admin/curriculum/chapters/create?subject_id=3&education_level_id=10',
    )
    const headings = w.findAll('[data-testid=chapter-heading]').map((h) => h.text())
    expect(headings).toEqual(['Bab 1: Bab nama 1', 'Bab : Bab nama 2'])
    expect(w.findAll('[data-testid=topic-heading]').map((h) => h.text())).toEqual([
      'Topik 10: Topik nama 10',
      'Topik : Topik nama 11',
    ])
    expect(w.get('[data-testid=chapter-description]').text()).toBe('Penerangan bab')
    expect(w.findAll('[data-testid=topic-add]').map((a) => a.attributes('href'))).toEqual([
      '/admin/curriculum/topics/create?chapter_id=1',
      '/admin/curriculum/topics/create?chapter_id=2',
    ])
    expect(w.get('[data-testid=chapter-edit]').attributes('href')).toBe(
      '/admin/curriculum/chapters/1/edit',
    )
    expect(w.get('[data-testid=chapter-edit]').attributes('title')).toBe('Edit Bab')
    expect(w.get('[data-testid=chapter-delete]').attributes('title')).toBe('Padam Bab')
    expect(w.get('[data-testid=topic-edit]').attributes('href')).toBe(
      '/admin/curriculum/topics/10/edit',
    )
  })

  it('shows the empty tree card with the first-chapter link', async () => {
    api.fetchCurriculumTree.mockResolvedValue(tree([]))
    const { w } = await render()
    expect(w.get('[data-testid=tree-empty]').text()).toContain(
      'Tiada bab dijumpai untuk subjek dan tahap ini.',
    )
    expect(w.get('[data-testid=chapter-add-first]').text()).toBe('Tambah Bab Pertama')
    expect(w.get('[data-testid=chapter-add-first]').attributes('href')).toBe(
      '/admin/curriculum/chapters/create?subject_id=3&education_level_id=10',
    )
  })

  it('opens chapters by default and topics collapsed; the chevrons toggle', async () => {
    const { w } = await render()
    const chapterTopics = w.get('[data-testid=chapter-topics]')
    expect(chapterTopics.isVisible()).toBe(true)
    await w.get('[data-testid=chapter-toggle]').trigger('click')
    expect(chapterTopics.isVisible()).toBe(false)
    await w.get('[data-testid=chapter-toggle]').trigger('click')
    expect(chapterTopics.isVisible()).toBe(true)

    expect(w.find('[data-testid=topic-subtopics]').exists()).toBe(false)
    const toggles = w.findAll('[data-testid=topic-toggle]')
    await toggles[0]!.trigger('click')
    expect(w.get('[data-testid=topic-subtopics]').isVisible()).toBe(true)
    expect(w.get('[data-testid=subtopic-row]').text()).toContain('Sub A')
    await toggles[1]!.trigger('click')
    expect(w.findAll('[data-testid=topic-subtopics]')[1]!.text()).toContain('Tiada subtopik')
  })

  it('deletes a chapter only after the confirm, reloads and flashes the status', async () => {
    api.deleteChapter.mockResolvedValue({ data: {}, status: 'Bab berjaya dipadam.' })
    const { w } = await render()
    dialogs.confirmNative.mockReturnValueOnce(false)
    await w.get('[data-testid=chapter-delete]').trigger('click')
    await flushPromises()
    expect(dialogs.confirmNative).toHaveBeenCalledWith('Adakah anda pasti mahu padam bab ini?')
    expect(api.deleteChapter).not.toHaveBeenCalled()

    dialogs.confirmNative.mockReturnValueOnce(true)
    await w.get('[data-testid=chapter-delete]').trigger('click')
    await flushPromises()
    expect(api.deleteChapter).toHaveBeenCalledWith(1)
    expect(api.fetchCurriculumTree).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current).toEqual({ type: 'success', message: 'Bab berjaya dipadam.' })
  })

  it('confirms topic and subtopic deletes with the live copy', async () => {
    api.deleteTopic.mockResolvedValue({ data: {}, status: 'Topik berjaya dipadam.' })
    api.deleteSubtopic.mockResolvedValue({ data: {}, status: 'Subtopik berjaya dipadam.' })
    const { w } = await render()
    dialogs.confirmNative.mockReturnValue(true)
    await w.findAll('[data-testid=topic-delete]')[0]!.trigger('click')
    await flushPromises()
    expect(dialogs.confirmNative).toHaveBeenLastCalledWith(
      'Adakah anda pasti mahu padam topik ini?',
    )
    expect(api.deleteTopic).toHaveBeenCalledWith(10)

    await w.findAll('[data-testid=topic-toggle]')[0]!.trigger('click')
    await w.get('[data-testid=subtopic-delete]').trigger('click')
    await flushPromises()
    expect(dialogs.confirmNative).toHaveBeenLastCalledWith(
      'Adakah anda pasti mahu padam subtopik ini?',
    )
    expect(api.deleteSubtopic).toHaveBeenCalledWith(100)
  })

  it('shows a red flash when a delete fails and keeps the tree', async () => {
    api.deleteChapter.mockRejectedValue(new Error('boom'))
    const { w } = await render()
    dialogs.confirmNative.mockReturnValue(true)
    await w.get('[data-testid=chapter-delete]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current?.type).toBe('error')
    expect(w.findAll('[data-testid=chapter]')).toHaveLength(2)
    expect(api.fetchCurriculumTree).toHaveBeenCalledTimes(1)
  })

  it('add subtopic: toggle label, "Batal" only hides and keeps the typed text, submit posts', async () => {
    api.createSubtopic.mockResolvedValue({ data: {}, status: 'Subtopik berjaya ditambah.' })
    const { w } = await render()
    await w.findAll('[data-testid=topic-toggle]')[0]!.trigger('click')
    const toggle = w.get('[data-testid=subtopic-add-toggle]')
    expect(toggle.text()).toBe('Tambah Subtopik')
    expect(w.get('[data-testid=subtopic-add-form]').isVisible()).toBe(false)
    await toggle.trigger('click')
    expect(toggle.text()).toBe('Batal')
    expect(w.get('[data-testid=subtopic-add-form]').isVisible()).toBe(true)
    const name = w.get('[data-testid=subtopic-add-name]')
    expect(name.attributes('placeholder')).toBe('Nama Subtopik (BM)')
    expect(name.attributes('required')).toBeDefined()
    await name.setValue('Draf')
    await toggle.trigger('click')
    expect(w.get('[data-testid=subtopic-add-form]').isVisible()).toBe(false)
    await toggle.trigger('click')
    expect((w.get('[data-testid=subtopic-add-name]').element as HTMLInputElement).value).toBe(
      'Draf',
    )

    await w.get('[data-testid=subtopic-add-objective]').setValue('Objektif')
    await w.get('[data-testid=subtopic-add-form]').trigger('submit')
    await flushPromises()
    expect(api.createSubtopic).toHaveBeenCalledWith({
      topicId: 10,
      name: 'Draf',
      nameEn: null,
      learningObjective: 'Objektif',
    })
    expect(useFlashStore().current?.message).toBe('Subtopik berjaya ditambah.')
    // The tree reloads, so the topics are collapsed again.
    expect(w.find('[data-testid=topic-subtopics]').exists()).toBe(false)
  })

  it('edit subtopic: replaces the row, one at a time, "Batal" keeps the typed text, "Simpan" puts', async () => {
    api.updateSubtopic.mockResolvedValue({ data: {}, status: 'Subtopik berjaya dikemaskini.' })
    api.fetchCurriculumTree.mockResolvedValue(
      tree([
        chapter(1, {
          topics: [topic(10, 1, { subtopics: [subtopic(100, 10, 'Sub A'), subtopic(101, 10)] })],
        }),
      ]),
    )
    const { w } = await render()
    await w.get('[data-testid=topic-toggle]').trigger('click')
    const rows = w.findAll('[data-testid=subtopic-row]')
    const forms = w.findAll('[data-testid=subtopic-edit-form]')
    await w.findAll('[data-testid=subtopic-edit]')[0]!.trigger('click')
    expect(rows[0]!.isVisible()).toBe(false)
    expect(forms[0]!.isVisible()).toBe(true)
    expect((w.get('[data-testid=subtopic-edit-name]').element as HTMLInputElement).value).toBe(
      'Sub A',
    )
    await w.findAll('[data-testid=subtopic-edit]')[1]!.trigger('click')
    expect(forms[0]!.isVisible()).toBe(false)
    expect(rows[0]!.isVisible()).toBe(true)
    expect(forms[1]!.isVisible()).toBe(true)

    await w.findAll('[data-testid=subtopic-edit]')[0]!.trigger('click')
    await w.findAll('[data-testid=subtopic-edit-name]')[0]!.setValue('Diubah')
    await w.findAll('[data-testid=subtopic-edit-cancel]')[0]!.trigger('click')
    expect(rows[0]!.text()).toContain('Sub A')
    await w.findAll('[data-testid=subtopic-edit]')[0]!.trigger('click')
    expect(
      (w.findAll('[data-testid=subtopic-edit-name]')[0]!.element as HTMLInputElement).value,
    ).toBe('Diubah')

    await forms[0]!.trigger('submit')
    await flushPromises()
    expect(api.updateSubtopic).toHaveBeenCalledWith(100, {
      name: 'Diubah',
      nameEn: null,
      learningObjective: null,
    })
    expect(useFlashStore().current?.message).toBe('Subtopik berjaya dikemaskini.')
  })

  it('filter submit navigates with both parameters (empty ones included)', async () => {
    const { w, router } = await render('/admin/curriculum')
    await w.get('[data-testid=curriculum-subject]').setValue('3')
    await w.get('[data-testid=curriculum-filter]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe(
      '/admin/curriculum?subject_id=3&education_level_id=',
    )
    expect(w.find('[data-testid=curriculum-prompt]').exists()).toBe(true)

    await w.get('[data-testid=curriculum-level]').setValue('10')
    await w.get('[data-testid=curriculum-filter]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe(
      '/admin/curriculum?subject_id=3&education_level_id=10',
    )
    expect(w.find('[data-testid=curriculum-stats]').exists()).toBe(true)
  })

  it('shows the load error placeholder when the tree fails to load', async () => {
    api.fetchCurriculumTree.mockRejectedValue(new Error('x'))
    const { w } = await render()
    expect(w.get('[data-testid=curriculum-load-error]').text()).toContain(
      'Ralat memuatkan data. Sila cuba semula.',
    )
    expect(w.find('[data-testid=curriculum-stats]').exists()).toBe(false)
  })
})
