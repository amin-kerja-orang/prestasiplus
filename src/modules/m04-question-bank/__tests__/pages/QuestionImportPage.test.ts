// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import QuestionImportPage from '../../pages/QuestionImportPage.vue'

const imports = vi.hoisted(() => ({ importQuestions: vi.fn(), downloadImportTemplate: vi.fn() }))
const lookups = vi.hoisted(() => ({ fetchSubjects: vi.fn(), fetchEducationLevels: vi.fn() }))
vi.mock('../../api/imports', () => imports)
vi.mock('../../api/lookups', () => lookups)

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/questions', component: stub },
      { path: '/admin/questions/import-history', component: stub },
      { path: '/page', component: QuestionImportPage },
    ],
  })
  await router.push('/page')
  wrapper = mount(QuestionImportPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

async function pickFile(w: VueWrapper, file: File): Promise<void> {
  const input = t(w, 'import-file')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

beforeEach(() => {
  setActivePinia(createPinia())
  imports.importQuestions.mockReset()
  imports.downloadImportTemplate.mockReset()
  lookups.fetchSubjects.mockReset().mockResolvedValue({ data: [{ id: 3, name: 'Matematik' }] })
  lookups.fetchEducationLevels
    .mockReset()
    .mockResolvedValue({ data: [{ id: 4, name: 'Tingkatan 5' }] })
  window.scrollTo = vi.fn()
  // jsdom has no object URLs; the file field lists the chosen file with a preview.
  URL.createObjectURL = vi.fn(() => 'blob:mock')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('QuestionImportPage (M04 S5)', () => {
  it('renders the links, the form with difficulty 2 preselected and the three side cards', async () => {
    const w = await render()
    expect(t(w, 'import-history-link').attributes('href')).toBe('/admin/questions/import-history')
    expect(t(w, 'import-back').attributes('href')).toBe('/admin/questions')
    const file = t(w, 'import-file')
    expect(file.attributes('accept')).toBe('.csv,.txt')
    expect(file.attributes('required')).toBeDefined()
    expect((t(w, 'import-default-difficulty').element as HTMLSelectElement).value).toBe('2')
    expect(
      t(w, 'import-default-subject')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['-- Tidak ditetapkan --', 'Matematik'])
    expect(t(w, 'import-default-difficulty').findAll('option')).toHaveLength(6)
    expect(w.text()).toContain('Saiz maksimum: 5MB. Format: CSV atau TXT')
    expect(w.text()).toContain('Soalan disimpan sebagai draf')
    expect(t(w, 'import-format-card').text()).toContain('ID subjek (atau guna Tetapan Lalai)')
    expect(w.findAll('[data-testid=import-tips-card] li')).toHaveLength(4)
  })

  it('imports the chosen file with the defaults, flashes the API status and resets the form', async () => {
    imports.importQuestions.mockResolvedValue({
      data: {},
      status: 'Import selesai: 1 soalan diimport, 1 gagal.',
    })
    const w = await render()
    const file = new File(['a,b'], 'soalan.csv', { type: 'text/csv' })
    await pickFile(w, file)
    await t(w, 'import-default-subject').setValue('3')
    await t(w, 'import-default-level').setValue('4')
    await t(w, 'import-form').trigger('submit')
    await flushPromises()
    expect(imports.importQuestions).toHaveBeenCalledWith({
      csvFile: file,
      defaultSubjectId: 3,
      defaultEducationLevelId: 4,
      defaultDifficultyLevel: 2,
    })
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Import selesai: 1 soalan diimport, 1 gagal.',
    })
    expect((t(w, 'import-default-subject').element as HTMLSelectElement).value).toBe('')
    expect(w.find('[data-testid=import-alert]').exists()).toBe(false)
  })

  it('shows a server validation error only in the red alert, keeping the input', async () => {
    imports.importQuestions.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { csvFile: 'Fail mesti jenis CSV atau TXT dan tidak melebihi 5MB.' },
      }),
    )
    const w = await render()
    await t(w, 'import-default-subject').setValue('3')
    await t(w, 'import-form').trigger('submit')
    await flushPromises()
    expect(w.findAll('[data-testid=import-alert]')).toHaveLength(1)
    expect(w.text().match(/Fail mesti jenis CSV/g)).toHaveLength(1)
    expect((t(w, 'import-default-subject').element as HTMLSelectElement).value).toBe('3')
    expect(useFlashStore().current).toBeNull()
  })

  it('downloads the template under its file name', async () => {
    const blob = new Blob(['x'])
    imports.downloadImportTemplate.mockResolvedValue({
      blob,
      filename: 'template-import-soalan.csv',
    })
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const w = await render()
    await t(w, 'import-template-download').trigger('click')
    await flushPromises()
    expect(imports.downloadImportTemplate).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    click.mockRestore()
  })
})
