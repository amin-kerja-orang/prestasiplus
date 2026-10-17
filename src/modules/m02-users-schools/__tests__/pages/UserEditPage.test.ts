// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router'
import { useFlashStore } from '@/stores/flash'

import type { SchoolSummary } from '../../api/schools'
import type { AdminUserDetail, StudentSearchItem } from '../../api/users'
import UserEditPage from '../../pages/UserEditPage.vue'

const users = vi.hoisted(() => ({
  fetchAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  searchStudents: vi.fn(),
}))
const schools = vi.hoisted(() => ({ searchSchools: vi.fn() }))
vi.mock('../../api/users', () => users)
vi.mock('../../api/schools', () => schools)

const SCHOOL: SchoolSummary = {
  id: 9167,
  name: 'SMK CONTOH BARU',
  code: 'MEA1234',
  type: 'SMK',
  state: 'Melaka',
  district: 'PPD MELAKA TENGAH',
  city: null,
}
const OTHER_SCHOOL: SchoolSummary = { ...SCHOOL, id: 12, name: 'SMK LAIN', district: null }
const CHILD: StudentSearchItem = {
  id: 2,
  name: 'Pelajar Demo',
  classLevel: 'T5',
  schoolName: 'SMK CONTOH',
}
const OTHER_CHILD: StudentSearchItem = {
  id: 4,
  name: 'Pelajar Maju',
  classLevel: 'D1',
  schoolName: null,
}

function detail(over: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: 2,
    name: 'Pelajar Demo',
    email: 'pelajar@demo.test',
    phone: '0191234567',
    role: 'student',
    grade: 10,
    schoolId: SCHOOL.id,
    bio: null,
    avatarUrl: null,
    createdAt: '2026-09-21T02:15:00+08:00',
    updatedAt: '2026-09-22T13:45:00+08:00',
    lastLoginAt: null,
    school: SCHOOL,
    landingPath: '/dashboard',
    icNumber: 'xxxxxx-xx-xx01',
    isActive: true,
    subscriptionPackage: 'regular_monthly',
    hasPkskSubscription: false,
    ppdState: null,
    ppdDistrict: null,
    linkedStudents: [],
    ...over,
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(id = 2): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', component: { template: '<div />' } },
      { path: '/form', component: UserEditPage },
    ],
  })
  await router.push('/form')
  wrapper = mount(UserEditPage, {
    props: { id },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function t(w: VueWrapper, id: string) {
  return w.get(`[data-testid=${id}]`)
}

async function search(w: VueWrapper, id: string, value: string): Promise<void> {
  await t(w, id).setValue(value)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  for (const fn of [...Object.values(users), ...Object.values(schools)]) fn.mockReset()
  users.fetchAdminUser.mockResolvedValue(detail())
  users.searchStudents.mockResolvedValue([CHILD, OTHER_CHILD])
  schools.searchSchools.mockResolvedValue([OTHER_SCHOOL])
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('UserEditPage (M02 S3) student record', () => {
  it('shows the profile header and pre-fills the form', async () => {
    const w = await render()
    expect(users.fetchAdminUser).toHaveBeenCalledWith(2, expect.anything())
    expect(t(w, 'user-profile-name').text()).toBe('Pelajar Demo')
    expect(t(w, 'user-profile-email').text()).toBe('pelajar@demo.test')
    expect(t(w, 'user-profile-created').text()).toBe('Daftar: 21/09/2026')
    expect(t(w, 'user-profile-updated').text()).toBe('Kemaskini: 22/09/2026 13:45')
    expect(t(w, 'user-profile').text()).toContain('PD')
    expect((t(w, 'user-name').element as HTMLInputElement).value).toBe('Pelajar Demo')
    expect((t(w, 'user-email').element as HTMLInputElement).value).toBe('pelajar@demo.test')
    expect((t(w, 'user-phone').element as HTMLInputElement).value).toBe('0191234567')
    expect(t(w, 'user-phone').attributes('maxlength')).toBe('14')
    expect(t(w, 'user-name').attributes('required')).toBeDefined()
    expect(t(w, 'user-email').attributes('required')).toBeDefined()
    expect(t(w, 'user-role').attributes('required')).toBeDefined()
    expect((t(w, 'user-role').element as HTMLSelectElement).value).toBe('student')
    expect(w.findAll('[data-testid=user-role] option').map((o) => o.text())).toEqual([
      'Pelajar',
      'Guru',
      'Ibu Bapa',
      'Penaja',
      'Admin Sekolah',
      'Pegawai PPD',
      'Pegawai JPN',
      'Admin',
    ])
    expect((t(w, 'grade-10').element as HTMLInputElement).checked).toBe(true)
    expect((t(w, 'user-ic').element as HTMLInputElement).value).toBe('xxxxxx-xx-xx01')
    expect((t(w, 'user-package').element as HTMLSelectElement).value).toBe('regular_monthly')
    expect(w.findAll('[data-testid=user-package] option').map((o) => o.text())).toEqual([
      'Tiada (Percuma / Trial)',
      'Regular Bulanan — RM10/bulan (1 bulan)',
      'Personal Per Sesi — RM200 (hingga 10 Jan)',
    ])
    expect((t(w, 'user-pksk').element as HTMLInputElement).checked).toBe(false)
    expect(t(w, 'user-pksk-status').text()).toBe('Tiada Akses')
    expect(w.text()).toContain(
      'Tukar pakej secara manual. Tarikh tamat dikira automatik mengikut jenis pakej.',
    )
    expect(t(w, 'admin-school-name').text()).toBe('SMK CONTOH BARU')
    expect(t(w, 'admin-school-chip').text()).toContain('SMK · Melaka · PPD MELAKA TENGAH')
    expect((t(w, 'user-active').element as HTMLInputElement).checked).toBe(true)
    expect(w.text()).toContain('Status Aktif')
    expect(t(w, 'user-submit').text()).toBe('Kemaskini')
    expect(t(w, 'user-cancel').attributes('href')).toBe('/admin/users')
    expect(w.find('[data-testid=parent-linker-edit]').exists()).toBe(false)
  })

  it('shows the four "Nota Keselamatan" lines', async () => {
    const w = await render()
    const notes = t(w, 'user-security-notes')
    expect(notes.text()).toContain('Nota Keselamatan')
    expect(notes.findAll('li').map((l) => l.text())).toEqual([
      'Pengguna akan menerima notifikasi jika maklumat akaun diubah',
      'Kata laluan boleh ditukar melalui bahagian "Tukar Kata Laluan"',
      'Perubahan peranan akan berkuat kuasa serta-merta',
      'Pengguna tidak aktif tidak boleh log masuk ke sistem',
    ])
  })

  it('toggles the password panel with its copy', async () => {
    const w = await render()
    expect(t(w, 'user-password-toggle').text()).toContain('Tukar Kata Laluan')
    expect(w.text()).toContain('Klik untuk buka bahagian reset kata laluan')
    expect(t(w, 'user-password-panel').isVisible()).toBe(false)
    await t(w, 'user-password-toggle').trigger('click')
    expect(t(w, 'user-password-panel').isVisible()).toBe(true)
    expect(t(w, 'user-new-password').attributes('placeholder')).toBe('Minimum 6 aksara')
    expect(t(w, 'user-new-password-confirm').attributes('placeholder')).toBe(
      'Taip semula kata laluan baru',
    )
    expect(w.text()).toContain(
      'Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa serta-merta.',
    )
  })

  it('saves the edited student: only the visible section is sent, the unchanged masked IC is not', async () => {
    users.updateAdminUser.mockResolvedValue({
      data: detail(),
      status: 'Pengguna berjaya dikemaskini.',
    })
    const w = await render()
    await t(w, 'user-name').setValue('Nama Baru')
    await t(w, 'grade-8').setValue(true)
    await t(w, 'user-package').setValue('personal')
    await t(w, 'user-pksk').setValue(true)
    await t(w, 'user-active').setValue(false)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.updateAdminUser).toHaveBeenCalledWith(2, {
      name: 'Nama Baru',
      email: 'pelajar@demo.test',
      phone: '0191234567',
      role: 'student',
      isActive: false,
      grade: 8,
      subscriptionPackage: 'personal',
      hasPkskSubscription: true,
      schoolId: 9167,
    })
    expect(router.currentRoute.value.path).toBe('/admin/users')
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Pengguna berjaya dikemaskini.',
    })
  })

  it('sends the IC only when it was edited, and the new password with its confirmation', async () => {
    users.updateAdminUser.mockResolvedValue({ data: detail(), status: 'ok' })
    const w = await render()
    await t(w, 'user-ic').setValue('031215101234')
    await t(w, 'user-password-toggle').trigger('click')
    await t(w, 'user-new-password').setValue('baru1234')
    await t(w, 'user-new-password-confirm').setValue('baru1234')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.updateAdminUser).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        icNumber: '031215101234',
        newPassword: 'baru1234',
        newPasswordConfirmation: 'baru1234',
      }),
    )
  })

  it('clears the school with the chip button and searches with a state and the 20-row limit', async () => {
    users.updateAdminUser.mockResolvedValue({ data: detail(), status: 'ok' })
    const w = await render()
    await t(w, 'admin-school-clear').trigger('click')
    expect(w.find('[data-testid=admin-school-chip]').exists()).toBe(false)
    expect(t(w, 'admin-school-search').attributes('placeholder')).toBe(
      'Taip nama sekolah (min. 2 huruf)...',
    )
    const options = w.findAll('[data-testid=admin-school-state] option').map((o) => o.text())
    expect(options).toHaveLength(17)
    expect(options[0]).toBe('Semua Negeri')
    expect(options).toContain('KL')
    expect(options).toContain('N. Sembilan')
    expect(options).toContain('P. Pinang')

    // A state alone triggers the search; one character without a state does not.
    await search(w, 'admin-school-search', 'a')
    expect(schools.searchSchools).not.toHaveBeenCalled()
    await t(w, 'admin-school-state').setValue('Melaka')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(schools.searchSchools).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'a', state: 'Melaka', limit: 20 }),
    )
    const rows = w.findAll('[data-testid=admin-school-result]')
    expect(rows[0]?.text()).toContain('SMK LAIN')
    expect(rows[0]?.text()).toContain('SMK · Melaka')
    await rows[0]?.trigger('click')
    expect(t(w, 'admin-school-name').text()).toBe('SMK LAIN')

    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.updateAdminUser).toHaveBeenCalledWith(2, expect.objectContaining({ schoolId: 12 }))
  })

  it('sends schoolId null when the school was cleared', async () => {
    users.updateAdminUser.mockResolvedValue({ data: detail(), status: 'ok' })
    const w = await render()
    await t(w, 'admin-school-clear').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.updateAdminUser).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ schoolId: null }),
    )
  })

  it('shows the empty result and the spinner while a school search runs', async () => {
    schools.searchSchools.mockResolvedValue([])
    const w = await render()
    await t(w, 'admin-school-clear').trigger('click')
    await search(w, 'admin-school-search', 'zzzz')
    expect(t(w, 'admin-school-empty').text()).toBe('Tiada sekolah dijumpai')
    let resolve: (rows: SchoolSummary[]) => void = () => undefined
    schools.searchSchools.mockReturnValue(
      new Promise<SchoolSummary[]>((r) => {
        resolve = r
      }),
    )
    await t(w, 'admin-school-search').setValue('yyyy')
    await vi.advanceTimersByTimeAsync(300)
    expect(w.find('[data-testid=admin-school-loading]').exists()).toBe(true)
    resolve([])
    await flushPromises()
    expect(w.find('[data-testid=admin-school-loading]').exists()).toBe(false)
  })

  it('a school search error shows nothing and logs "Search error:"', async () => {
    schools.searchSchools.mockRejectedValue(new Error('gagal'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const w = await render()
    await t(w, 'admin-school-clear').trigger('click')
    await search(w, 'admin-school-search', 'abcd')
    expect(spy).toHaveBeenCalledWith('Search error:', expect.anything())
    expect(w.find('[data-testid=admin-school-empty]').exists()).toBe(false)
    spy.mockRestore()
  })
})

describe('UserEditPage (M02 S3) role sections follow the select (DV-M02-04)', () => {
  it('teacher shows only the school; other roles show no section; the loaded values come back', async () => {
    const w = await render()
    await t(w, 'user-role').setValue('teacher')
    expect(w.find('[data-testid=grade-cards]').exists()).toBe(false)
    expect(w.find('[data-testid=user-package-block]').exists()).toBe(false)
    expect(t(w, 'admin-school-name').text()).toBe('SMK CONTOH BARU')
    await t(w, 'user-role').setValue('sponsor')
    expect(w.find('[data-testid=admin-school]').exists()).toBe(false)
    await t(w, 'user-role').setValue('student')
    expect((t(w, 'grade-10').element as HTMLInputElement).checked).toBe(true)
    expect((t(w, 'user-ic').element as HTMLInputElement).value).toBe('xxxxxx-xx-xx01')
    expect(t(w, 'admin-school-name').text()).toBe('SMK CONTOH BARU')
  })

  it('a section for a role the record did not have starts empty', async () => {
    users.fetchAdminUser.mockResolvedValue(
      detail({
        role: 'sponsor',
        grade: null,
        schoolId: null,
        school: null,
        icNumber: null,
        subscriptionPackage: 'none',
      }),
    )
    const w = await render()
    expect(w.find('[data-testid=grade-cards]').exists()).toBe(false)
    await t(w, 'user-role').setValue('student')
    const checked = w
      .findAll('[data-testid=grade-cards] input')
      .filter((i) => (i.element as HTMLInputElement).checked)
    expect(checked).toHaveLength(0)
    expect((t(w, 'user-ic').element as HTMLInputElement).value).toBe('')
    expect((t(w, 'user-package').element as HTMLSelectElement).value).toBe('none')
    expect((t(w, 'user-pksk').element as HTMLInputElement).checked).toBe(false)
    expect(w.find('[data-testid=admin-school-chip]').exists()).toBe(false)
    await t(w, 'user-role').setValue('parent')
    expect(w.findAll('[data-testid=linker-chip]')).toHaveLength(0)
    expect(t(w, 'linker-none').text()).toBe('Tiada pelajar dipautkan lagi')
  })

  it('a non-student role is saved without the student and school fields', async () => {
    users.updateAdminUser.mockResolvedValue({ data: detail(), status: 'ok' })
    const w = await render()
    await t(w, 'user-role').setValue('sponsor')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.updateAdminUser).toHaveBeenCalledWith(2, {
      name: 'Pelajar Demo',
      email: 'pelajar@demo.test',
      phone: '0191234567',
      role: 'sponsor',
      isActive: true,
    })
  })
})

describe('UserEditPage (M02 S3) parent record', () => {
  beforeEach(() => {
    users.fetchAdminUser.mockResolvedValue(
      detail({
        id: 6,
        name: 'Ibu Bapa Demo',
        role: 'parent',
        grade: null,
        schoolId: null,
        school: null,
        icNumber: null,
        subscriptionPackage: 'none',
        linkedStudents: [CHILD],
      }),
    )
  })

  it('shows the linked children card with chips, hint and no student fields', async () => {
    const w = await render(6)
    const card = t(w, 'parent-linker-edit')
    expect(card.text()).toContain('Anak yang Dipautkan')
    expect(card.findAll('[data-testid=linker-chip]')).toHaveLength(1)
    expect(card.text()).toContain('Pelajar Demo')
    expect(card.text()).toContain('T5')
    expect(card.text()).toContain('SMK CONTOH')
    expect(t(w, 'linker-remove').attributes('title')).toBe('Buang pautan')
    expect(t(w, 'linker-search').attributes('placeholder')).toBe(
      'Cari nama atau emel pelajar untuk dipautkan...',
    )
    expect(card.text()).toContain(
      'Tambah atau buang pautan anak. Perubahan disimpan apabila klik "Kemaskini".',
    )
    expect(w.find('[data-testid=grade-cards]').exists()).toBe(false)
    expect(w.find('[data-testid=admin-school]').exists()).toBe(false)
  })

  it('adds and removes chips and saves the whole set', async () => {
    users.updateAdminUser.mockResolvedValue({ data: detail(), status: 'ok' })
    const w = await render(6)
    await search(w, 'linker-search', 'maj')
    const rows = w.findAll('[data-testid=linker-result]')
    expect(rows[0]?.attributes('disabled')).toBeDefined()
    await rows[0]?.trigger('click')
    expect(w.findAll('[data-testid=linker-chip]')).toHaveLength(1)
    await rows[1]?.trigger('click')
    expect(w.findAll('[data-testid=linker-chip]')).toHaveLength(2)
    await w.findAll('[data-testid=linker-remove]')[0]?.trigger('click')

    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.updateAdminUser).toHaveBeenCalledWith(6, {
      name: 'Ibu Bapa Demo',
      email: 'pelajar@demo.test',
      phone: '0191234567',
      role: 'parent',
      isActive: true,
      linkedStudentIds: [4],
    })
  })

  it('the empty student search shows "Tiada pelajar dijumpai"', async () => {
    users.searchStudents.mockResolvedValue([])
    const w = await render(6)
    await search(w, 'linker-search', 'zzzz')
    expect(t(w, 'linker-empty').text()).toBe('Tiada pelajar dijumpai')
  })
})

describe('UserEditPage (M02 S3) errors and loading', () => {
  it('shows the server errors in the red alert, keeps the values and clears the passwords', async () => {
    users.updateAdminUser.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: {
          email: 'The email has already been taken.',
          newPassword: 'The new password field confirmation does not match.',
        },
      }),
    )
    const w = await render()
    await t(w, 'user-name').setValue('Nama Kekal')
    await t(w, 'user-password-toggle').trigger('click')
    await t(w, 'user-new-password').setValue('baru1234')
    await t(w, 'user-new-password-confirm').setValue('lain1234')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(
      t(w, 'user-form-alert')
        .findAll('p')
        .map((p) => p.text()),
    ).toEqual([
      'The email has already been taken.',
      'The new password field confirmation does not match.',
    ])
    expect((t(w, 'user-name').element as HTMLInputElement).value).toBe('Nama Kekal')
    expect((t(w, 'user-new-password').element as HTMLInputElement).value).toBe('')
    expect((t(w, 'user-new-password-confirm').element as HTMLInputElement).value).toBe('')
    expect(router.currentRoute.value.path).toBe('/form')
  })

  it('shows a skeleton while loading', async () => {
    users.fetchAdminUser.mockReturnValue(new Promise(() => undefined))
    const w = await render()
    expect(w.find('[data-testid=user-form-skeleton]').exists()).toBe(true)
    expect(w.find('[data-testid=user-form]').exists()).toBe(false)
  })

  it('an unknown user (404) is the standard 404 outcome, not a red box', async () => {
    users.fetchAdminUser.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Pengguna tidak dijumpai.' }),
    )
    await render(999)
    expect(useRouteOutcome().value).toBe(404)
    setRouteOutcome(null)
  })

  it('another load failure keeps the red box and the way back, and retries', async () => {
    users.fetchAdminUser.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }),
    )
    const w = await render(2)
    expect(useRouteOutcome().value).toBeNull()
    expect(t(w, 'user-load-error').text()).toContain('Ralat pelayan.')
    expect(w.find('[data-testid=user-form]').exists()).toBe(false)
    expect(t(w, 'user-back').attributes('href')).toBe('/admin/users')
    users.fetchAdminUser.mockResolvedValue(detail())
    await w.get('[data-testid=user-load-error] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=user-form]').exists()).toBe(true)
  })
})
