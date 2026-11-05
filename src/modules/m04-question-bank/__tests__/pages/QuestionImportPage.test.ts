// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import QuestionImportPage from '../../pages/QuestionImportPage.vue'

const imports = vi.hoisted(() => ({
  importQuestions: vi.fn(),
  downloadImportTemplate: vi.fn(),
  downloadImportErrors: vi.fn(),
}))
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
  it('renders the links, the form with no default difficulty (11-05) and the three side cards', async () => {
    const w = await render()
    expect(t(w, 'import-history-link').attributes('href')).toBe('/admin/questions/import-history')
    expect(t(w, 'import-back').attributes('href')).toBe('/admin/questions')
    const file = t(w, 'import-file')
    expect(file.attributes('accept')).toBe('.csv,.txt')
    expect(file.attributes('required')).toBeDefined()
    expect((t(w, 'import-default-difficulty').element as HTMLSelectElement).value).toBe('')
    expect(
      t(w, 'import-default-subject')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['-- Tidak ditetapkan --', 'Matematik'])
    expect(t(w, 'import-default-difficulty').findAll('option')).toHaveLength(6)
    expect(w.text()).toContain('Saiz maksimum: 5MB. Format: CSV atau TXT')
    expect(w.text()).toContain('Soalan akan disimpan sebagai draf')
    expect(t(w, 'import-format-card').text()).toContain('Kod subjek dan Tingkatan (atau guna Tetapan Lalai)')
    expect(w.findAll('[data-testid=import-tips-card] li')).toHaveLength(4)
  })

  it('imports the chosen file with the defaults, flashes the API status and resets the form', async () => {
    imports.importQuestions.mockResolvedValue({
      data: { failures: [] },
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
      defaultDifficultyLevel: null,
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

  describe('row report (FR-QA-34, FR-ADM-Q11.1)', () => {
    const run = (over: Record<string, unknown> = {}) => ({
      data: { id: 12, fileName: 'a.csv', importedCount: 9, failedCount: 1, failures: [{ row: 4, questionKey: 'q3', field: 'tp', code: 'TP_RANGE', message: 'Baris 4: TP mesti antara 1 dan 6.' }, { row: 5, message: 'Kolum hilang.' }], ...over },
      status: 'Import selesai: 9 soalan diimport, 1 gagal.',
    })

    it('lists each failed row and warning, and downloads the error CSV of the run', async () => {
      imports.importQuestions.mockResolvedValue({ ...run(), warnings: ['Kolum x tidak dikenali dan diabaikan.'] })
      const blob = new Blob(['x'])
      imports.downloadImportErrors.mockResolvedValue({ blob, filename: null })
      const w = await render()
      await pickFile(w, new File(['x'], 'a.csv', { type: 'text/csv' }))
      await t(w, 'import-form').trigger('submit')
      await flushPromises()
      expect(t(w, 'import-failures').findAll('li').map((l) => l.text())).toEqual([
        'Baris 4: TP mesti antara 1 dan 6. (tp)',
        'Baris 5: Kolum hilang.',
      ])
      expect(t(w, 'import-warnings').text()).toContain('Kolum x tidak dikenali')
      expect(t(w, 'import-errors-download').text()).toBe('Muat turun laporan ralat (CSV)')
      await t(w, 'import-errors-download').trigger('click')
      await flushPromises()
      expect(imports.downloadImportErrors).toHaveBeenCalledWith(12)
      expect(useFlashStore().current?.type).toBe('success')
    })

    it('shows the warnings of a run with no failed row', async () => {
      imports.importQuestions.mockResolvedValue({ ...run({ failedCount: 0, failures: [] }), warnings: ['Kolum x tidak dikenali dan diabaikan.'] })
      const w = await render()
      await pickFile(w, new File(['x'], 'a.csv', { type: 'text/csv' }))
      await t(w, 'import-form').trigger('submit')
      await flushPromises()
      expect(t(w, 'import-warnings').text()).toContain('Kolum x tidak dikenali')
      expect(w.find('[data-testid=import-failures]').exists()).toBe(false)
    })

    it('shows no report for a clean run', async () => {
      imports.importQuestions.mockResolvedValue(run({ failedCount: 0, failures: [] }))
      const w = await render()
      await pickFile(w, new File(['x'], 'a.csv', { type: 'text/csv' }))
      await t(w, 'import-form').trigger('submit')
      await flushPromises()
      expect(w.find('[data-testid=import-report]').exists()).toBe(false)
      expect(useFlashStore().current?.type).toBe('success')
    })

    it('a refused file clears the last banner and the last report', async () => {
      imports.importQuestions.mockResolvedValueOnce(run())
      imports.importQuestions.mockRejectedValueOnce(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Fail melebihi 2,000 baris. Pecahkan fail kepada beberapa bahagian.' }))
      const w = await render()
      await pickFile(w, new File(['x'], 'a.csv', { type: 'text/csv' }))
      await t(w, 'import-form').trigger('submit')
      await flushPromises()
      await pickFile(w, new File(['y'], 'b.csv', { type: 'text/csv' }))
      await t(w, 'import-form').trigger('submit')
      await flushPromises()
      expect(useFlashStore().current).toBeNull()
      expect(w.find('[data-testid=import-report]').exists()).toBe(false)
      expect(t(w, 'import-alert').text()).toContain('Fail melebihi 2,000 baris.')
    })
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
