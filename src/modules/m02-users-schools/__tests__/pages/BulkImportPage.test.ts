// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { SchoolSummary } from '../../api/schools'
import BulkImportPage from '../../pages/BulkImportPage.vue'

const imports = vi.hoisted(() => ({ importUsers: vi.fn() }))
const users = vi.hoisted(() => ({ fetchAdminDefaults: vi.fn() }))
const schools = vi.hoisted(() => ({ searchSchools: vi.fn() }))
vi.mock('../../api/imports', () => imports)
vi.mock('../../api/users', () => users)
vi.mock('../../api/schools', () => schools)

const DEFAULT_PASSWORD = 'contoh-kata-laluan'
const SCHOOL: SchoolSummary = {
  id: 77,
  name: 'SEKOLAH KEBANGSAAN CONTOH BARU',
  code: 'ABC0077',
  type: 'SK',
  state: 'Selangor',
  district: 'PPD GOMBAK',
  city: null,
}

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', component: { template: '<div />' } },
      { path: '/admin/import-students', component: { template: '<div />' } },
      { path: '/page', component: BulkImportPage },
    ],
  })
  await router.push('/page')
  wrapper = mount(BulkImportPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

async function pickRole(w: VueWrapper, role: string): Promise<void> {
  await w.get(`[data-testid=bulk-role-${role}] input`).setValue(true)
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  imports.importUsers.mockReset()
  schools.searchSchools.mockReset().mockResolvedValue([SCHOOL])
  users.fetchAdminDefaults.mockReset().mockResolvedValue({
    schoolAdminDefaultPassword: 'a',
    bulkImportDefaultPassword: DEFAULT_PASSWORD,
    compStudentDefaultPassword: 'b',
  })
  window.scrollTo = vi.fn()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('BulkImportPage (M02 S4)', () => {
  it('shows the hero, the four unchecked role cards, the pre-filled default password and the notes', async () => {
    const w = await render()
    expect(w.text()).toContain('Import Pengguna Pukal')
    expect(w.text()).toContain('Daftarkan guru, ibu bapa, atau pentadbir sekolah secara pukal.')
    expect(w.text()).toContain('Borang Import Pengguna')
    const radios = w.findAll('input[name=role]')
    expect(radios.map((r) => r.attributes('value'))).toEqual([
      'teacher',
      'parent',
      'school_admin',
      'ppd_officer',
    ])
    expect(radios.every((r) => (r.element as HTMLInputElement).checked === false)).toBe(true)
    expect(radios.every((r) => r.attributes('required') !== undefined)).toBe(true)
    const pw = t(w, 'bulk-default-password')
    expect((pw.element as HTMLInputElement).value).toBe(DEFAULT_PASSWORD)
    expect(pw.attributes('placeholder')).toBe(DEFAULT_PASSWORD)
    expect(pw.attributes('required')).toBeUndefined()
    expect(w.text()).toContain('Kata laluan jika tidak dinyatakan dalam data import.')
    expect(t(w, 'import-paste').attributes('placeholder')).toBe(
      'Paste data CSV:\n\nNama, Emel, Telefon\nMuhammad Fulan bin Fulan, ahmad@email.com, 0123456789',
    )
    expect(t(w, 'bulk-format').text()).toContain(
      'Baris pertama akan dilangkau jika ia mengandungi tajuk (header).',
    )
    expect(t(w, 'bulk-back').attributes('href')).toBe('/admin/users')
    expect(t(w, 'bulk-students-link').attributes('href')).toBe('/admin/import-students')
    expect(w.findAll('[data-testid=bulk-notes] li')).toHaveLength(4)
  })

  it('shows the school picker for Guru and Admin only', async () => {
    const w = await render()
    expect(w.find('[data-testid=bulk-school]').exists()).toBe(false)
    await pickRole(w, 'teacher')
    expect(w.find('[data-testid=bulk-school]').exists()).toBe(true)
    await pickRole(w, 'parent')
    expect(w.find('[data-testid=bulk-school]').exists()).toBe(false)
    await pickRole(w, 'school_admin')
    expect(w.find('[data-testid=bulk-school]').exists()).toBe(true)
    await pickRole(w, 'ppd_officer')
    expect(w.find('[data-testid=bulk-school]').exists()).toBe(false)
  })

  it('searches from 2 characters, picks a school, shows "Dipilih: ..." and clears it', async () => {
    const w = await render()
    await pickRole(w, 'teacher')
    await t(w, 'bulk-school-search').setValue('a')
    await vi.advanceTimersByTimeAsync(300)
    expect(schools.searchSchools).not.toHaveBeenCalled()
    await t(w, 'bulk-school-search').setValue('SEKOLAH')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(t(w, 'bulk-school-result').text()).toContain('SEKOLAH KEBANGSAAN CONTOH BARU (ABC0077)')
    await t(w, 'bulk-school-result').trigger('click')
    expect(t(w, 'bulk-school-chosen').text()).toContain(
      'Dipilih: SEKOLAH KEBANGSAAN CONTOH BARU (ABC0077)',
    )
    expect(t(w, 'bulk-school-search').attributes('placeholder')).toBe(SCHOOL.name)
    await t(w, 'bulk-school-clear').trigger('click')
    expect(w.find('[data-testid=bulk-school-chosen]').exists()).toBe(false)
    expect(t(w, 'bulk-school-search').attributes('placeholder')).toBe(
      '-- Cari nama atau kod sekolah...',
    )
  })

  it('shows "Tiada sekolah dijumpai" when nothing matches', async () => {
    schools.searchSchools.mockResolvedValue([])
    const w = await render()
    await pickRole(w, 'teacher')
    await t(w, 'bulk-school-search').setValue('zzz')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(t(w, 'bulk-school-empty').text()).toBe('Tiada sekolah dijumpai')
  })

  it('CSV mode shows the drop zone and the chosen file name', async () => {
    const w = await render()
    await t(w, 'import-mode-csv').trigger('click')
    expect(w.text()).toContain('Seret & Lepas fail CSV di sini')
    expect(w.text()).toContain('atau')
    expect(w.text()).toContain('Pilih Fail')
    expect(t(w, 'import-file').attributes('accept')).toBe('.csv,.txt')
    expect(t(w, 'import-file-status').text()).toBe('Tiada fail dipilih')
    const input = t(w, 'import-file').element as HTMLInputElement
    const csv = new File(['a,b'], 'demo.csv', { type: 'text/csv' })
    Object.defineProperty(input, 'files', { value: [csv], configurable: true })
    await t(w, 'import-file').trigger('change')
    expect(t(w, 'import-file-status').text()).toBe('Fail dipilih: demo.csv')
  })

  it('imports a paste as Guru + school, shows the result flash and resets the form', async () => {
    imports.importUsers.mockResolvedValue({
      data: {
        created: 1,
        skipped: 1,
        failed: 1,
        errors: [{ line: 3, message: 'Emel tidak sah.' }],
      },
      status: 'Import selesai: 1 pengguna didaftarkan, 1 dilangkau, 1 gagal.',
    })
    const w = await render()
    await pickRole(w, 'teacher')
    await t(w, 'bulk-school-search').setValue('SEKOLAH')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    await t(w, 'bulk-school-result').trigger('click')
    await t(w, 'import-paste').setValue('Guru Demo Satu, guru1@demo.test')
    await t(w, 'bulk-form').trigger('submit')
    await flushPromises()
    expect(imports.importUsers).toHaveBeenCalledWith({
      role: 'teacher',
      schoolId: 77,
      defaultPassword: DEFAULT_PASSWORD,
      importMode: 'paste',
      csvFile: null,
      pasteContent: 'Guru Demo Satu, guru1@demo.test',
    })
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Import selesai: 1 pengguna didaftarkan, 1 dilangkau, 1 gagal.',
    })
    expect(
      w.findAll('input[name=role]').every((r) => !(r.element as HTMLInputElement).checked),
    ).toBe(true)
    expect(w.find('[data-testid=bulk-school]').exists()).toBe(false)
    expect((t(w, 'import-paste').element as HTMLTextAreaElement).value).toBe('')
  })

  it('does not send a school for Ibu Bapa', async () => {
    imports.importUsers.mockResolvedValue({
      data: { created: 0, skipped: 0, failed: 0, errors: [] },
      status: 'x',
    })
    const w = await render()
    await pickRole(w, 'parent')
    await t(w, 'import-paste').setValue('Ibu Demo, ibu@demo.test')
    await t(w, 'bulk-form').trigger('submit')
    await flushPromises()
    expect(imports.importUsers.mock.calls[0]?.[0]).toMatchObject({ role: 'parent', schoolId: null })
  })

  it('shows a server refusal in the red alert and keeps the input', async () => {
    imports.importUsers.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'The given data was invalid.',
        fields: {
          schoolId: 'The school id field is required.',
          pasteContent: 'Tiada data untuk diimport.',
        },
      }),
    )
    const w = await render()
    await pickRole(w, 'teacher')
    await t(w, 'import-paste').setValue('   ')
    await t(w, 'bulk-form').trigger('submit')
    await flushPromises()
    const alert = t(w, 'bulk-alert')
    expect(alert.text()).toContain('The school id field is required.')
    expect(alert.text()).toContain('Tiada data untuk diimport.')
    expect((w.get('input[value=teacher]').element as HTMLInputElement).checked).toBe(true)
    expect(useFlashStore().current).toBeNull()
  })
})
