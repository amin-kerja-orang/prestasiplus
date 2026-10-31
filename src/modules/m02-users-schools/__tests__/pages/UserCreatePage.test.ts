// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { Jpn, Ppd, SchoolSummary } from '../../api/schools'
import type { StudentSearchItem } from '../../api/users'
import UserCreatePage from '../../pages/UserCreatePage.vue'
import { expectListInFlow } from './in-flow'
import { expectFinderWidthContract } from './parent-finder-width'

const users = vi.hoisted(() => ({
  createAdminUser: vi.fn(),
  fetchAdminDefaults: vi.fn(),
  searchStudents: vi.fn(),
}))
const schools = vi.hoisted(() => ({
  searchSchools: vi.fn(),
  fetchJpnList: vi.fn(),
  fetchPpdList: vi.fn(),
}))
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
const SCHOOL_NO_CODE: SchoolSummary = { ...SCHOOL, id: 78, name: 'SK TIADA KOD', code: '' }
const STUDENTS: StudentSearchItem[] = [
  { id: 101, name: 'Pelajar Satu', classLevel: 'T5', schoolName: 'SMK CONTOH' },
  { id: 102, name: 'Pelajar Dua', classLevel: null, schoolName: null },
]
const JPNS: Jpn[] = [
  { id: 1, code: 'JPN-J', name: 'Johor' },
  { id: 2, code: 'JPN-S', name: 'Selangor' },
]
const PPDS: Ppd[] = [{ id: 11, jpnId: 2, code: 'PPD GOMBAK', name: 'PPD Gombak' }]

let wrapper: VueWrapper | null = null
let router: Router
const writeText = vi.fn()

async function render(): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', component: { template: '<div />' } },
      { path: '/form', component: UserCreatePage },
    ],
  })
  await router.push('/form')
  wrapper = mount(UserCreatePage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function t(w: VueWrapper, id: string) {
  return w.get(`[data-testid=${id}]`)
}

async function type(w: VueWrapper, id: string, value: string): Promise<void> {
  await t(w, id).setValue(value)
}

/** Types into a debounced search box and lets the 300 ms debounce and the request finish. */
async function search(w: VueWrapper, id: string, value: string): Promise<void> {
  await t(w, id).setValue(value)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  for (const fn of [...Object.values(users), ...Object.values(schools), writeText]) fn.mockReset()
  users.fetchAdminDefaults.mockResolvedValue({
    schoolAdminDefaultPassword: DEFAULT_PASSWORD,
    bulkImportDefaultPassword: 'x',
    compStudentDefaultPassword: 'y',
  })
  users.searchStudents.mockResolvedValue(STUDENTS)
  schools.searchSchools.mockResolvedValue([SCHOOL, SCHOOL_NO_CODE])
  schools.fetchJpnList.mockResolvedValue(JPNS)
  schools.fetchPpdList.mockResolvedValue(PPDS)
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('UserCreatePage (M02 S2) role-driven form', () => {
  it('shows the card and only "Peranan *" until a role is chosen', async () => {
    const w = await render()
    expect(w.text()).toContain('Borang Pendaftaran Pengguna')
    expect(w.text()).toContain('Isi maklumat untuk mendaftarkan pengguna baru')
    expect(w.findAll('[data-testid=user-role] option').map((o) => o.text())).toEqual([
      '-- Pilih Peranan --',
      'Pelajar',
      'Guru',
      'Ibu Bapa',
      'Penaja',
      'Admin Sekolah',
      'Pegawai PPD',
      'Pegawai JPN',
      'Admin',
    ])
    expect(t(w, 'user-role').attributes('required')).toBeDefined()
    expect(w.find('[data-testid=user-fields]').exists()).toBe(false)
    expect(w.find('[data-testid=user-form-footer]').exists()).toBe(false)
    expect(schools.fetchJpnList).toHaveBeenCalledTimes(1)
  })

  it('a standard role shows the FR-M02-22 fields with their copy and no HTML required', async () => {
    const w = await render()
    await type(w, 'user-role', 'admin')
    expect(w.get('label[for=user-name]').text()).toContain('Nama *')
    expect(t(w, 'user-name').attributes('placeholder')).toBe('Nama penuh')
    expect(t(w, 'user-email').attributes('placeholder')).toBe('contoh@email.com')
    expect(t(w, 'user-email').attributes('type')).toBe('email')
    expect(t(w, 'user-phone').attributes('maxlength')).toBe('14')
    expect(t(w, 'user-phone').attributes('inputmode')).toBe('tel')
    expect(t(w, 'user-phone').attributes('placeholder')).toBe('Cth: 0191234567')
    expect(t(w, 'user-password').attributes('placeholder')).toBe('Minimum 6 aksara')
    expect(t(w, 'user-password-confirm').attributes('placeholder')).toBe('Taip semula kata laluan')
    for (const id of [
      'user-name',
      'user-email',
      'user-phone',
      'user-password',
      'user-password-confirm',
    ]) {
      expect(t(w, id).attributes('required')).toBeUndefined()
    }
    expect(t(w, 'user-active').attributes('aria-checked')).toBe('true')
    expect(w.text()).toContain('Aktifkan Akaun')
    expect(w.text()).toContain('Pengguna yang tidak aktif tidak boleh log masuk')
    // No student / teacher / parent section for admin.
    expect(w.find('[data-testid=grade-cards]').exists()).toBe(false)
    expect(w.find('[data-testid=std-school]').exists()).toBe(false)
    expect(w.find('[data-testid=parent-linker]').exists()).toBe(false)
    expect(t(w, 'form-submit').text()).toBe('Daftar Pengguna')
    expect(t(w, 'form-cancel').attributes('href')).toBe('/admin/users')
    expect(t(w, 'form-cancel').text()).toBe('Batal')
    expect(w.find('form').attributes('novalidate')).toBeUndefined()
  })

  it('student: 5 grade cards (none checked), IC with its hint, school picker', async () => {
    const w = await render()
    await type(w, 'user-role', 'student')
    const cards = w.findAll('[data-testid=grade-cards] button[role=radio]')
    expect(cards).toHaveLength(5)
    expect(cards.some((c) => c.attributes('aria-checked') === 'true')).toBe(false)
    const labels = w.findAll('[data-testid=grade-cards] [data-slot="label"]').map((l) => l.text())
    expect(labels).toEqual([
      'Ting. 1',
      'Ting. 2',
      'Ting. 3',
      'Ting. 4',
      'Ting. 5',
    ])
    expect(w.text()).not.toContain('Sekolah Rendah')
    expect(w.text()).not.toContain('Darjah')
    expect(w.text()).toContain('Sekolah Menengah')
    expect(w.find('[data-testid=grade-cards] button[role=radio][value="7"]').exists()).toBe(true)
    expect(t(w, 'user-ic').attributes('maxlength')).toBe('14')
    expect(t(w, 'user-ic').attributes('inputmode')).toBe('numeric')
    expect(t(w, 'user-ic').attributes('placeholder')).toBe('Cth: 031215101234')
    expect(w.text()).toContain('12 digit MyKad. Dilindungi PDPA.')
    expect(t(w, 'std-school-search').attributes('placeholder')).toBe('Cari nama sekolah...')
  })

  it('creates a student with grade, school and IC, queues the flash and goes to the list', async () => {
    users.createAdminUser.mockResolvedValue({ data: {}, status: 'Pengguna berjaya didaftarkan.' })
    const w = await render()
    await type(w, 'user-role', 'student')
    await type(w, 'user-name', 'Muhammad Fulan bin Fulan')
    await type(w, 'user-email', 'fulan@contoh.test')
    await type(w, 'user-password', 'rahsia123')
    await type(w, 'user-password-confirm', 'rahsia123')
    await w.get('[data-testid=grade-cards] button[role=radio][value="10"]').trigger('click')
    await type(w, 'user-ic', '031215101234')
    await search(w, 'std-school-search', 'contoh')
    expect(schools.searchSchools).toHaveBeenCalledWith(expect.objectContaining({ q: 'contoh' }))
    const rows = w.findAll('[data-testid=std-school-result]')
    expect(rows[0]?.text()).toBe('SEKOLAH KEBANGSAAN CONTOH BARU (SK, Selangor)')
    await rows[0]?.trigger('click')
    expect(t(w, 'std-school-chosen').text()).toBe('SEKOLAH KEBANGSAAN CONTOH BARU')
    expect(w.find('[data-testid=std-school-dropdown]').exists()).toBe(false)

    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.createAdminUser).toHaveBeenCalledWith({
      role: 'student',
      name: 'Muhammad Fulan bin Fulan',
      email: 'fulan@contoh.test',
      phone: '',
      password: 'rahsia123',
      passwordConfirmation: 'rahsia123',
      isActive: true,
      grade: 10,
      icNumber: '031215101234',
      schoolId: 77,
    })
    expect(router.currentRoute.value.path).toBe('/admin/users')
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Pengguna berjaya didaftarkan.',
    })
  })

  it('the school search shows nothing for one character, no loading text and no empty text', async () => {
    const w = await render()
    await type(w, 'user-role', 'teacher')
    await search(w, 'std-school-search', 'a')
    expect(schools.searchSchools).not.toHaveBeenCalled()
    schools.searchSchools.mockResolvedValue([])
    await search(w, 'std-school-search', 'zzzz')
    expect(schools.searchSchools).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid=std-school-dropdown]').exists()).toBe(false)
    expect(w.text()).not.toContain('Tiada sekolah dijumpai')
  })

  it('a role change keeps the standard fields, the grade, the IC and the school pick (FR-M02-21)', async () => {
    const w = await render()
    await type(w, 'user-role', 'student')
    await type(w, 'user-name', 'Nama Kekal')
    await type(w, 'user-email', 'kekal@contoh.test')
    await type(w, 'user-password', 'rahsia123')
    await w.get('[data-testid=grade-cards] button[role=radio][value="9"]').trigger('click')
    await type(w, 'user-ic', '0312')
    await search(w, 'std-school-search', 'contoh')
    await w.findAll('[data-testid=std-school-result]')[0]?.trigger('click')

    await type(w, 'user-role', 'teacher')
    expect((t(w, 'user-name').element as HTMLInputElement).value).toBe('Nama Kekal')
    expect((t(w, 'user-password').element as HTMLInputElement).value).toBe('rahsia123')
    expect(t(w, 'std-school-chosen').text()).toBe('SEKOLAH KEBANGSAAN CONTOH BARU')
    expect(w.find('[data-testid=grade-cards]').exists()).toBe(false)

    await type(w, 'user-role', 'student')
    expect(
      w.get('[data-testid=grade-cards] button[role=radio][value="9"]').attributes('aria-checked'),
    ).toBe('true')
    expect((t(w, 'user-ic').element as HTMLInputElement).value).toBe('0312')
  })

  it('shows the server errors in the red alert, keeps the values and clears the passwords', async () => {
    users.createAdminUser.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'The given data was invalid.',
        fields: {
          name: 'The name field is required.',
          password: 'The password field must be at least 6 characters.',
          grade: 'The grade field is required when role is student.',
        },
      }),
    )
    const w = await render()
    await type(w, 'user-role', 'student')
    await type(w, 'user-email', 'kekal@contoh.test')
    await type(w, 'user-password', 'abc')
    await type(w, 'user-password-confirm', 'abc')
    await w.get('form').trigger('submit')
    await flushPromises()
    const alert = t(w, 'user-form-alert')
    expect(alert.findAll('p').map((p) => p.text())).toEqual([
      'The name field is required.',
      'The password field must be at least 6 characters.',
      'The grade field is required when role is student.',
    ])
    expect((t(w, 'user-role').element as HTMLSelectElement).value).toBe('student')
    expect((t(w, 'user-email').element as HTMLInputElement).value).toBe('kekal@contoh.test')
    expect((t(w, 'user-password').element as HTMLInputElement).value).toBe('')
    expect((t(w, 'user-password-confirm').element as HTMLInputElement).value).toBe('')
    expect(router.currentRoute.value.path).toBe('/form')
    expect(useFlashStore().pending).toBeNull()
  })
})

describe('UserCreatePage (M02 S2) parent', () => {
  it('links students with chips; a linked row is dimmed and adds nothing', async () => {
    users.createAdminUser.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await render()
    await type(w, 'user-role', 'parent')
    expect(w.text()).toContain('Pautkan Anak (Pelajar)')
    expect(t(w, 'linker-search').attributes('placeholder')).toBe('Cari nama atau emel pelajar...')
    expect(w.text()).toContain(
      'Boleh pautkan lebih dari satu pelajar. Boleh juga ditambah kemudian.',
    )
    expect(w.find('[data-testid=linker-chips]').exists()).toBe(false)

    await t(w, 'linker-search').trigger('focus')
    await search(w, 'linker-search', 'pel')
    expect(users.searchStudents).toHaveBeenCalledWith('pel', expect.anything())
    let rows = w.findAll('[data-testid=linker-result]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.text()).toContain('Pelajar Satu')
    expect(rows[0]?.text()).toContain('T5')
    expect(rows[0]?.text()).toContain('SMK CONTOH')
    await rows[0]?.trigger('click')

    expect(w.findAll('[data-testid=linker-chip]')).toHaveLength(1)
    expect(w.text().toLowerCase()).toContain('anak yang dipautkan:')
    expect(t(w, 'linker-remove').attributes('title')).toBe('Buang')

    await search(w, 'linker-search', 'pel')
    rows = w.findAll('[data-testid=linker-result]')
    expect(rows[0]?.attributes('disabled')).toBeDefined()
    expect(rows[0]?.attributes('disabled')).toBeDefined()
    await rows[0]?.trigger('click')
    expect(w.findAll('[data-testid=linker-chip]')).toHaveLength(1)
    await rows[1]?.trigger('click')
    expect(w.findAll('[data-testid=linker-chip]')).toHaveLength(2)

    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.createAdminUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'parent', linkedStudentIds: [101, 102] }),
    )
    expect(users.createAdminUser.mock.calls[0]?.[0]).not.toHaveProperty('icNumber')
  })

  it('removes a chip, and shows the loading indicator and the empty result', async () => {
    const w = await render()
    await type(w, 'user-role', 'parent')
    await search(w, 'linker-search', 'pel')
    await w.findAll('[data-testid=linker-result]')[0]?.trigger('click')
    await t(w, 'linker-remove').trigger('click')
    expect(w.findAll('[data-testid=linker-chip]')).toHaveLength(0)

    let resolve: (rows: StudentSearchItem[]) => void = () => undefined
    users.searchStudents.mockReturnValue(
      new Promise<StudentSearchItem[]>((r) => {
        resolve = r
      }),
    )
    await t(w, 'linker-search').setValue('nadir')
    await vi.advanceTimersByTimeAsync(300)
    expect(w.find('[data-testid=linker-loading]').exists()).toBe(true)
    expect(w.find('[data-testid=linker-empty]').exists()).toBe(false)
    resolve([])
    await flushPromises()
    expect(w.find('[data-testid=linker-loading]').exists()).toBe(false)
    expect(t(w, 'linker-empty').text()).toBe('Tiada pelajar dijumpai')
  })

  it('a role change clears the linked children', async () => {
    const w = await render()
    await type(w, 'user-role', 'parent')
    await search(w, 'linker-search', 'pel')
    await w.findAll('[data-testid=linker-result]')[0]?.trigger('click')
    await type(w, 'user-role', 'sponsor')
    await type(w, 'user-role', 'parent')
    expect(w.findAll('[data-testid=linker-chip]')).toHaveLength(0)
  })
})

describe('UserCreatePage (M02 S2) parent linker list', () => {
  it('draws the student result list in the flow, not floating (SWX4-07, SWX4-08)', async () => {
    const w = await render()
    await type(w, 'user-role', 'parent')
    await search(w, 'linker-search', 'pel')
    expect(w.findAll('[data-testid=linker-result]')).toHaveLength(2)
    expectListInFlow(w, 'linker-dropdown')
  })

  it('keeps the form column within the card while the results show (BUG-05, DV-M02-29)', async () => {
    const w = await render()
    await type(w, 'user-role', 'parent')
    await search(w, 'linker-search', 'pel')
    expectFinderWidthContract(w, 'parent-linker')
  })
})

describe('UserCreatePage (M02 S2) school admin', () => {
  async function pickSchool(w: VueWrapper, index = 0): Promise<void> {
    await type(w, 'user-role', 'school_admin')
    await t(w, 'gen-search').trigger('focus')
    await search(w, 'gen-search', 'contoh')
    await w.findAll('[data-testid=gen-result]')[index]?.trigger('click')
  }

  it('lists rows with state • district • type and the code, "Tiada kod" when none, and the empty result', async () => {
    const w = await render()
    await type(w, 'user-role', 'school_admin')
    expect(w.text()).toContain('Cari Sekolah *')
    expect(t(w, 'gen-search').attributes('placeholder')).toBe(
      'Taipkan nama sekolah atau kod sekolah (cth: JBA0001)...',
    )
    expect(w.find('[data-testid=user-fields]').exists()).toBe(false)
    expect(t(w, 'form-submit').attributes('disabled')).toBeDefined()
    await search(w, 'gen-search', 'contoh')
    const rows = w.findAll('[data-testid=gen-result]')
    expect(rows[0]?.text()).toContain('SEKOLAH KEBANGSAAN CONTOH BARU')
    expect(rows[0]?.text()).toContain('Selangor • PPD GOMBAK • SK')
    expect(rows[0]?.text()).toContain('ABC0077')
    expect(rows[1]?.text()).toContain('Tiada kod')
    schools.searchSchools.mockResolvedValue([])
    await search(w, 'gen-search', 'tiadaada')
    expect(t(w, 'gen-empty').text()).toBe('Tiada sekolah dijumpai')
  })

  it('draws both school result lists in the flow, not floating: the form-section card clips its overflow (RS5-M1)', async () => {
    const w = await render()
    await type(w, 'user-role', 'school_admin')
    await search(w, 'gen-search', 'contoh')
    // An `absolute` list is cut by the card (`overflow-clip`); the list is a surface in the flow that scrolls inside.
    const inFlow = (id: string): void => {
      const list = t(w, id)
      expect(list.attributes('data-ds')).toBe('surface')
      expect(list.classes()).not.toContain('absolute')
      expect(list.attributes('data-behavior')).toBeUndefined()
      const scroller = list.element.firstElementChild
      expect(scroller?.className).toContain('max-h-64')
      expect(scroller?.className).toContain('overflow-y-auto')
    }
    inFlow('gen-dropdown')
    expect(t(w, 'school-admin-generator').element.contains(t(w, 'gen-dropdown').element)).toBe(true)
    // The student / teacher picker (same card clip) follows the same pattern.
    await type(w, 'user-role', 'student')
    await search(w, 'std-school-search', 'contoh')
    inFlow('std-school-dropdown')
  })

  it('shows "Sekolah Dipilih", generates the credentials, copies with the toast and submits', async () => {
    users.createAdminUser.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await render()
    await pickSchool(w)
    const chosen = t(w, 'gen-chosen')
    expect(chosen.text()).toContain('Sekolah Dipilih')
    expect(chosen.text()).toContain('ABC0077')
    expect(chosen.text()).toContain('SEKOLAH KEBANGSAAN CONTOH BARU')
    expect(chosen.text()).toContain('Selangor')
    expect(chosen.text()).toContain('PPD GOMBAK')
    expect(t(w, 'gen-reset').attributes('title')).toBe('Reset')
    expect(t(w, 'form-submit').attributes('disabled')).toBeDefined()

    expect(t(w, 'gen-generate').text()).toBe('Janakan Akaun Admin Sekolah')
    expect(t(w, 'gen-generate').attributes('disabled')).toBeUndefined()
    await t(w, 'gen-generate').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid=gen-generate]').exists()).toBe(false)
    expect(t(w, 'gen-box').text()).toContain('Maklumat Dijana')
    expect((t(w, 'gen-name').element as HTMLInputElement).value).toBe(
      'Pentadbir Sekolah Kebangsaan Contoh Baru',
    )
    expect((t(w, 'gen-email').element as HTMLInputElement).value).toBe('abc0077@prestasiplus.my')
    expect(t(w, 'gen-email').attributes('readonly')).toBeDefined()
    expect((t(w, 'gen-password').element as HTMLInputElement).value).toBe(DEFAULT_PASSWORD)
    expect(t(w, 'gen-phone').attributes('placeholder')).toBe('012-345 6789')
    expect(t(w, 'gen-jpn').text()).toBe('JPN: Selangor')
    expect(t(w, 'gen-ppd').text()).toBe('PPD: PPD GOMBAK')
    expect(t(w, 'gen-copy-email').attributes('title')).toBe('Salin')
    expect(t(w, 'form-submit').attributes('disabled')).toBeUndefined()

    // "Disalin!" toast for 2 s.
    expect(document.body.textContent).not.toContain('Disalin!')
    await t(w, 'gen-copy-password').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(DEFAULT_PASSWORD)
    expect(document.body.textContent).toContain('Disalin!')
    await vi.advanceTimersByTimeAsync(1900)
    expect(document.body.textContent).toContain('Disalin!')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(document.body.textContent).not.toContain('Disalin!')

    await t(w, 'gen-copy-email').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenLastCalledWith('abc0077@prestasiplus.my')
    expect(document.body.textContent).toContain('Disalin!')

    await t(w, 'gen-phone').setValue('012-345 6789')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.createAdminUser).toHaveBeenCalledWith({
      role: 'school_admin',
      name: 'Pentadbir Sekolah Kebangsaan Contoh Baru',
      email: 'abc0077@prestasiplus.my',
      phone: '012-345 6789',
      password: DEFAULT_PASSWORD,
      passwordConfirmation: DEFAULT_PASSWORD,
      isActive: true,
      schoolId: 77,
      ppdState: 'Selangor',
      ppdDistrict: 'PPD GOMBAK',
    })
    expect(router.currentRoute.value.path).toBe('/admin/users')
  })

  it('reset clears the school and the credentials and shows the search again', async () => {
    const w = await render()
    await pickSchool(w)
    await t(w, 'gen-generate').trigger('click')
    await flushPromises()
    await t(w, 'gen-reset').trigger('click')
    expect(w.find('[data-testid=gen-box]').exists()).toBe(false)
    expect(w.find('[data-testid=gen-chosen]').exists()).toBe(false)
    expect((t(w, 'gen-search').element as HTMLInputElement).value).toBe('')
  })

  it('a school without a code disables the button and shows the warning', async () => {
    const w = await render()
    await pickSchool(w, 1)
    expect(t(w, 'gen-generate').attributes('disabled')).toBeDefined()
    expect(t(w, 'gen-no-code').text()).toBe(
      'Sekolah ini tiada kod KPM. Sila kemaskini kod sekolah di halaman Sekolah terlebih dahulu.',
    )
    expect(t(w, 'gen-chosen').text()).not.toContain('ABC')
  })

  it('a role change drops the school and the generated credentials', async () => {
    const w = await render()
    await pickSchool(w)
    await t(w, 'gen-generate').trigger('click')
    await flushPromises()
    await type(w, 'user-role', 'admin')
    await type(w, 'user-role', 'school_admin')
    expect(w.find('[data-testid=gen-chosen]').exists()).toBe(false)
    expect(w.find('[data-testid=gen-box]').exists()).toBe(false)
  })
})

describe('UserCreatePage (M02 S2) officers', () => {
  it('ppd_officer: lists the 16 JPN, loads the PPD of the chosen JPN and submits the JPN name and PPD code', async () => {
    users.createAdminUser.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await render()
    await type(w, 'user-role', 'ppd_officer')
    expect(t(w, 'user-name').attributes('placeholder')).toBe('Nama penuh pegawai')
    expect(w.find('[data-testid=user-phone]').exists()).toBe(false)
    expect(w.find('[data-testid=user-active]').exists()).toBe(false)
    expect(w.findAll('[data-testid=officer-jpn] option').map((o) => o.text())).toEqual([
      '-- Pilih Negeri --',
      'Johor',
      'Selangor',
    ])
    expect(t(w, 'officer-ppd').attributes('disabled')).toBeDefined()
    expect(w.findAll('[data-testid=officer-ppd] option').map((o) => o.text())).toEqual([
      '-- Pilih PPD --',
    ])

    await type(w, 'officer-jpn', '2')
    await flushPromises()
    expect(schools.fetchPpdList).toHaveBeenCalledWith(2, expect.anything())
    expect(t(w, 'officer-ppd').attributes('disabled')).toBeUndefined()
    expect(w.findAll('[data-testid=officer-ppd] option').map((o) => o.text())).toEqual([
      '-- Pilih PPD --',
      'PPD Gombak',
    ])
    await type(w, 'officer-ppd', 'PPD GOMBAK')
    await type(w, 'user-name', 'Pegawai Ujian')
    await type(w, 'user-email', 'pegawai@contoh.test')
    await type(w, 'user-password', 'rahsia123')
    await type(w, 'user-password-confirm', 'rahsia123')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.createAdminUser).toHaveBeenCalledWith({
      role: 'ppd_officer',
      name: 'Pegawai Ujian',
      email: 'pegawai@contoh.test',
      password: 'rahsia123',
      passwordConfirmation: 'rahsia123',
      isActive: true,
      ppdState: 'Selangor',
      ppdDistrict: 'PPD GOMBAK',
    })
  })

  it('jpn_officer has no PPD select; a failed JPN load leaves only the first option', async () => {
    schools.fetchJpnList.mockRejectedValue(new Error('gagal'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const w = await render()
    await type(w, 'user-role', 'jpn_officer')
    expect(w.find('[data-testid=officer-ppd]').exists()).toBe(false)
    expect(w.findAll('[data-testid=officer-jpn] option').map((o) => o.text())).toEqual([
      '-- Pilih Negeri --',
    ])
    expect(spy).toHaveBeenCalledWith('JPN load error:', expect.anything())
    spy.mockRestore()
  })
})
