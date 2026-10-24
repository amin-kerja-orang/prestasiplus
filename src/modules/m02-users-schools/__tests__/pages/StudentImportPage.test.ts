// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { ExistingStudent, SchoolQuota } from '../../api/imports'
import type { SchoolSummary } from '../../api/schools'
import StudentImportPage from '../../pages/StudentImportPage.vue'

const imports = vi.hoisted(() => ({
  importStudents: vi.fn(),
  fetchSchoolQuota: vi.fn(),
  fetchSchoolStudents: vi.fn(),
}))
const schools = vi.hoisted(() => ({ searchSchools: vi.fn() }))
vi.mock('../../api/imports', () => imports)
vi.mock('../../api/schools', () => schools)

const SMK: SchoolSummary = {
  id: 8078,
  name: 'SEKOLAH MENENGAH CONTOH',
  code: 'ABC1',
  type: 'SMK',
  state: 'Selangor',
  district: 'PPD HULU LANGAT',
  city: null,
}
const SK: SchoolSummary = { ...SMK, id: 940, name: 'SEKOLAH KEBANGSAAN CONTOH', type: 'SK' }
const SJKC: SchoolSummary = { ...SMK, id: 555, name: 'SJK CINA CONTOH', type: 'SJK(C)' }

const AVAILABLE: SchoolQuota = { hasSubscription: true, quota: 1000, used: 2, remaining: 998 }
const FULL: SchoolQuota = { hasSubscription: true, quota: 415, used: 423, remaining: 0 }

function students(n: number): ExistingStudent[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Pelajar Demo ${String(i + 1)}`,
    email: `p${String(i + 1)}@demo.test`,
    idDelima: `m-${String(i + 1)}@moe-dl.edu.my`,
    classLevel: 'T5',
    isActive: true,
  }))
}

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin', component: { template: '<div />' } },
      { path: '/page', component: StudentImportPage },
    ],
  })
  await router.push('/page')
  wrapper = mount(StudentImportPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

async function pickSchool(w: VueWrapper, school: SchoolSummary): Promise<void> {
  schools.searchSchools.mockResolvedValue([school])
  await t(w, 'admin-school-search').setValue('SEKOLAH')
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  await t(w, 'admin-school-result').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  imports.importStudents.mockReset()
  imports.fetchSchoolQuota.mockReset().mockResolvedValue(AVAILABLE)
  imports.fetchSchoolStudents.mockReset().mockResolvedValue(students(3))
  schools.searchSchools.mockReset()
  window.scrollTo = vi.fn()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('StudentImportPage (M02 S5) content', () => {
  it('shows the hero, both class groups, the paste placeholder and help, the notes and "Kembali" to /admin', async () => {
    const w = await render()
    expect(w.text()).toContain('Import Pelajar via ID Delima')
    expect(w.text()).toContain(
      'Import pelajar dari Darjah 1 hingga Tingkatan 5 menggunakan ID Delima KPM.',
    )
    expect(w.text()).toContain('Borang Import Pelajar')
    expect(w.text()).toContain('Sekolah Rendah')
    expect(w.text()).toContain('Sekolah Menengah')
    expect(w.findAll('[data-testid=student-classes] button[role=radio]')).toHaveLength(11)
    expect(t(w, 'import-paste').attributes('placeholder')).toContain(
      'Paste data dari DELIMa (3-4 baris per pelajar):',
    )
    expect(t(w, 'student-format-paste').text()).toContain('Format DELIMa (3-4 baris per pelajar):')
    expect(t(w, 'student-format-paste').text()).toContain('(No. KP — pilihan)')
    expect(w.get('[data-ds="back-link"]').attributes('href')).toBe('/admin')
    expect(t(w, 'student-notes').text()).toContain('Nama pelajar akan ditukar kepada Huruf Besar Setiap Perkataan')
    expect(
      t(w, 'student-notes')
        .findAll('strong')
        .map((s) => s.text()),
    ).toEqual(['emel DELIMa', 'kata laluan DELIMa'])
  })

  it('CSV mode shows the DELIMa CSV format instead of the paste help', async () => {
    const w = await render()
    await t(w, 'import-mode-csv').trigger('click')
    expect(t(w, 'student-format-csv').text()).toContain(
      'Nama, Emel DELIMa, Kata Laluan, No KP (pilihan)',
    )
    expect(t(w, 'student-format-csv').text()).toContain(
      'Contoh: Muhammad Fulan bin Fulan, m-XXXXXXXX@moe-dl.edu.my, katalaluan123, 031215101234',
    )
    expect(w.find('[data-testid=student-format-paste]').exists()).toBe(false)
  })
})

describe('StudentImportPage (M02 S5) quota panel', () => {
  it('shows "Memeriksa kuota..." then the emerald panel with the bar and the remainder', async () => {
    let resolve!: (q: SchoolQuota) => void
    imports.fetchSchoolQuota.mockReturnValue(new Promise<SchoolQuota>((r) => (resolve = r)))
    const w = await render()
    await pickSchool(w, SMK)
    expect(t(w, 'quota-loading').text()).toContain('Memeriksa kuota...')
    resolve(AVAILABLE)
    await flushPromises()
    expect(t(w, 'quota-figures').text()).toBe('2 / 1000')
    expect(t(w, 'quota-summary').attributes('data-state')).toBe('available')
    expect(t(w, 'quota-bar').html()).toContain('aria-valuenow="0"')
    expect(t(w, 'quota-note').text()).toBe('Baki kuota: 998 pelajar')
  })

  it('a full quota is red with a 100% bar and the full text; Import stays enabled', async () => {
    imports.fetchSchoolQuota.mockResolvedValue(FULL)
    const w = await render()
    await pickSchool(w, SMK)
    expect(t(w, 'quota-figures').text()).toBe('423 / 415')
    expect(t(w, 'quota-bar').html()).toContain('aria-valuenow="100"')
    expect(t(w, 'quota-note').text()).toBe('Kuota penuh! Sila tingkatkan kuota dahulu.')
    expect(t(w, 'form-submit').attributes('disabled')).toBeUndefined()
  })

  it('no subscription and a failed request both show the warning', async () => {
    imports.fetchSchoolQuota.mockResolvedValue({ hasSubscription: false })
    const w = await render()
    await pickSchool(w, SK)
    expect(t(w, 'quota-none').text()).toContain(
      'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.',
    )
    expect(w.find('[data-testid=existing-students]').exists()).toBe(false)

    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    imports.fetchSchoolQuota.mockRejectedValue(new Error('boom'))
    await t(w, 'admin-school-clear').trigger('click')
    await pickSchool(w, SMK)
    expect(w.find('[data-testid=quota-none]').exists()).toBe(true)
    expect(spy).toHaveBeenCalledWith('Quota fetch error:', expect.any(Error))
    spy.mockRestore()
  })
})

describe('StudentImportPage (M02 S5) existing students', () => {
  it('shows the toggle with the count and loads the list on first open', async () => {
    imports.fetchSchoolQuota.mockResolvedValue({ ...AVAILABLE, used: 3 })
    const w = await render()
    await pickSchool(w, SMK)
    expect(t(w, 'existing-toggle').text()).toContain('Pelajar Sedia Ada (3 orang)')
    expect(imports.fetchSchoolStudents).not.toHaveBeenCalled()
    await t(w, 'existing-toggle').trigger('click')
    await flushPromises()
    expect(imports.fetchSchoolStudents).toHaveBeenCalledTimes(1)
    expect(w.findAll('[data-testid=existing-table] tbody tr')).toHaveLength(3)
    expect(w.find('[data-testid=existing-cap]').exists()).toBe(false)
    expect(w.findAll('[data-testid=existing-class] option').map((o) => o.text())).toEqual([
      'Semua Kelas',
      'T1',
      'T2',
      'T3',
      'T4',
      'T5',
    ])
  })

  it('is hidden when nobody is enrolled (used = 0)', async () => {
    imports.fetchSchoolQuota.mockResolvedValue({ ...AVAILABLE, used: 0, remaining: 1000 })
    const w = await render()
    await pickSchool(w, SMK)
    expect(w.find('[data-testid=existing-students]').exists()).toBe(false)
  })

  it('shows the 200-row notice at 200 rows and searches with a 300 ms debounce', async () => {
    imports.fetchSchoolQuota.mockResolvedValue({
      hasSubscription: true,
      quota: 1000,
      used: 549,
      remaining: 451,
    })
    imports.fetchSchoolStudents.mockResolvedValue(students(200))
    const w = await render()
    await pickSchool(w, SMK)
    await t(w, 'existing-toggle').trigger('click')
    await flushPromises()
    expect(t(w, 'existing-cap').text()).toBe(
      'Menunjukkan 200 pertama sahaja. Gunakan carian untuk cari pelajar tertentu.',
    )
    imports.fetchSchoolStudents.mockResolvedValue([])
    await t(w, 'existing-search').setValue('zzz')
    await vi.advanceTimersByTimeAsync(299)
    expect(imports.fetchSchoolStudents).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(imports.fetchSchoolStudents).toHaveBeenLastCalledWith(
      8078,
      expect.objectContaining({ search: 'zzz' }),
    )
    expect(t(w, 'existing-empty').text()).toContain('Tiada pelajar dijumpai')
    expect(w.find('[data-testid=existing-cap]').exists()).toBe(false)
  })

  it('a primary school filters D1–D6', async () => {
    const w = await render()
    await pickSchool(w, SK)
    await t(w, 'existing-toggle').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid=existing-class] option').map((o) => o.text())).toEqual([
      'Semua Kelas',
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
    ])
  })
})

describe('StudentImportPage (M02 S5) class cards', () => {
  it('SK and SJK show Darjah only, SMK Tingkatan only; a hidden checked card is unchecked', async () => {
    const w = await render()
    await w.get('button[role=radio][value=T3]').trigger('click')
    await pickSchool(w, SK)
    expect(w.find('[data-testid=class-group-secondary]').exists()).toBe(false)
    expect(w.findAll('[data-testid=student-classes] button[role=radio]')).toHaveLength(6)
    await w.get('button[role=radio][value=D2]').trigger('click')
    await t(w, 'admin-school-clear').trigger('click')
    expect(w.findAll('[data-testid=student-classes] button[role=radio]')).toHaveLength(11)
    expect(w.get('button[role=radio][value=D2]').attributes('aria-checked')).toBe('true')
    await pickSchool(w, SMK)
    expect(w.find('[data-testid=class-group-primary]').exists()).toBe(false)
    expect(w.findAll('[data-testid=student-classes] button[role=radio]')).toHaveLength(5)
    expect(w.text()).toContain('Tingkatan 5')
    await t(w, 'admin-school-clear').trigger('click')
    await pickSchool(w, SJKC)
    expect(w.find('[data-testid=class-group-secondary]').exists()).toBe(false)
    expect(w.text()).toContain('Darjah 6')
  })
})

describe('StudentImportPage (M02 S5) submit', () => {
  it('imports a paste, flashes the result and resets', async () => {
    imports.importStudents.mockResolvedValue({
      data: { created: 1, skipped: 1, failed: 0, errors: [] },
      status: 'Import selesai: 1 pelajar didaftarkan, 1 dilangkau.',
    })
    const w = await render()
    await pickSchool(w, SMK)
    await w.get('button[role=radio][value=T4]').trigger('click')
    await t(w, 'import-paste').setValue('PELAJAR DEMO SATU\nm-1@moe-dl.edu.my\nkata1')
    await t(w, 'student-form').trigger('submit')
    await flushPromises()
    expect(imports.importStudents).toHaveBeenCalledWith({
      schoolId: 8078,
      classLevel: 'T4',
      importMode: 'paste',
      csvFile: null,
      pasteContent: 'PELAJAR DEMO SATU\nm-1@moe-dl.edu.my\nkata1',
    })
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Import selesai: 1 pelajar didaftarkan, 1 dilangkau.',
    })
    expect(w.find('[data-testid=admin-school-chip]').exists()).toBe(false)
    expect((t(w, 'import-paste').element as HTMLTextAreaElement).value).toBe('')
  })

  it('shows a refusal in the red alert and keeps the school and the input', async () => {
    imports.importStudents.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'The given data was invalid.',
        fields: { schoolId: 'Kuota tidak mencukupi.' },
      }),
    )
    const w = await render()
    await pickSchool(w, SMK)
    await t(w, 'import-paste').setValue('X\nm-2@moe-dl.edu.my\nk')
    await t(w, 'student-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'student-alert').text()).toContain('Kuota tidak mencukupi.')
    expect(w.find('[data-testid=admin-school-chip]').exists()).toBe(true)
    expect((t(w, 'import-paste').element as HTMLTextAreaElement).value).toBe(
      'X\nm-2@moe-dl.edu.my\nk',
    )
  })
})
