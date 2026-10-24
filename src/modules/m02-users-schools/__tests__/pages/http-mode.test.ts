// @vitest-environment jsdom
/**
 * M02 admin user pages in http mode (D59b): no `/api/admin/config/defaults` call, no default-password text or
 * fields, no password pair on create or edit, the one-time password shown once, the whole role list kept on
 * edit, and the import credentials. Mock mode (flag off) keeps the default-password behaviour.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Component } from 'vue'

import { useFlashStore } from '@/stores/flash'

import type { AdminUserDetail } from '../../api/users'
import BulkImportPage from '../../pages/BulkImportPage.vue'
import CompStudentCreatePage from '../../pages/CompStudentCreatePage.vue'
import UserCreatePage from '../../pages/UserCreatePage.vue'
import UserEditPage from '../../pages/UserEditPage.vue'

const mode = vi.hoisted(() => ({ http: true }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => mode.http }))

const users = vi.hoisted(() => ({
  createAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  fetchAdminUser: vi.fn(),
  fetchAdminDefaults: vi.fn(),
  searchStudents: vi.fn(),
}))
vi.mock('../../api/users', async (importActual) => ({
  ...(await importActual<typeof import('../../api/users')>()),
  ...users,
}))
const imports = vi.hoisted(() => ({ importUsers: vi.fn() }))
vi.mock('../../api/imports', () => imports)
const comp = vi.hoisted(() => ({
  fetchTeachers: vi.fn(),
  fetchTeacherClassrooms: vi.fn(),
  registerCompStudents: vi.fn(),
}))
vi.mock('../../api/comp-students', () => comp)
const schools = vi.hoisted(() => ({
  searchSchools: vi.fn(),
  fetchJpnList: vi.fn(),
  fetchPpdList: vi.fn(),
}))
vi.mock('../../api/schools', () => schools)

const SECRET = 'Terjana-Rahsia-1'
const SCHOOL = {
  id: '77',
  name: 'SEKOLAH CONTOH BARU',
  code: 'ABC0077',
  type: 'SK',
  state: 'Selangor',
  district: 'PPD GOMBAK',
  city: null,
}

let wrapper: VueWrapper | null = null

async function mountPage(component: Component, path: string, props: Record<string, unknown> = {}) {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', component: stub },
      { path: '/admin/comp-students', component: stub },
      { path: '/admin/import-students', component: stub },
      { path, component },
    ],
  })
  await router.push(path)
  wrapper = mount(component, { props, global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return { w: wrapper, router }
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid=${id}]`).exists()

function detail(over: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: 7,
    name: 'Guru Admin Contoh',
    email: 'guruadmin@example.test',
    phone: null,
    role: 'school_admin',
    roles: ['school_admin', 'teacher'],
    grade: null,
    schoolId: 1,
    bio: null,
    avatarUrl: null,
    createdAt: '2026-09-21T02:15:00+08:00',
    updatedAt: '2026-09-22T13:45:00+08:00',
    lastLoginAt: null,
    school: null,
    landingPath: '/admin',
    icNumber: null,
    isActive: true,
    subscriptionPackage: 'none',
    hasPkskSubscription: false,
    ppdState: null,
    ppdDistrict: null,
    linkedStudents: [],
    ...over,
  }
}

beforeEach(() => {
  mode.http = true
  setActivePinia(createPinia())
  for (const fn of [
    ...Object.values(users),
    ...Object.values(imports),
    ...Object.values(comp),
    ...Object.values(schools),
  ])
    fn.mockReset()
  schools.fetchJpnList.mockResolvedValue([])
  schools.searchSchools.mockResolvedValue([SCHOOL])
  users.searchStudents.mockResolvedValue([])
  users.fetchAdminDefaults.mockResolvedValue({
    schoolAdminDefaultPassword: 'a',
    bulkImportDefaultPassword: 'b',
    compStudentDefaultPassword: 'c',
  })
  comp.fetchTeachers.mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('Tambah Pengguna (S2)', () => {
  it('http: never calls the defaults route, shows no password fields, sends none and shows the one-time password', async () => {
    users.createAdminUser.mockResolvedValue({
      data: { ...detail({ role: 'teacher', roles: ['teacher'] }), generatedPassword: SECRET },
      status: 'Pengguna berjaya didaftarkan.',
    })
    const { w, router } = await mountPage(UserCreatePage, '/admin/users/create')
    await t(w, 'user-role').setValue('teacher')
    expect(has(w, 'user-password')).toBe(false)
    expect(has(w, 'user-password-confirm')).toBe(false)
    await t(w, 'user-name').setValue('Guru Baharu')
    await t(w, 'user-email').setValue('baharu@example.test')
    await t(w, 'user-form').trigger('submit')
    await flushPromises()
    const sent = users.createAdminUser.mock.calls[0]?.[0] as Record<string, unknown>
    expect(sent).toMatchObject({
      role: 'teacher',
      name: 'Guru Baharu',
      email: 'baharu@example.test',
    })
    expect(sent).not.toHaveProperty('password')
    expect(sent).not.toHaveProperty('passwordConfirmation')
    expect(users.fetchAdminDefaults).not.toHaveBeenCalled()
    expect(t(w, 'credential-password').text()).toBe(SECRET)
    expect(t(w, 'generated-credentials').text()).toContain(
      'Maklumat log masuk pengguna — catat sekarang, ia tidak akan dipaparkan semula.',
    )
    expect(has(w, 'user-form')).toBe(false)
    expect(t(w, 'user-credential-continue').attributes('href')).toBe('/admin/users')
    expect(router.currentRoute.value.path).toBe('/admin/users/create')
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Pengguna berjaya didaftarkan.',
    })
  })

  it('http: the school-admin generator hides the password and creates without fetching the defaults', async () => {
    users.createAdminUser.mockResolvedValue({
      data: { ...detail(), generatedPassword: SECRET },
      status: 'ok',
    })
    vi.useFakeTimers()
    try {
      const { w } = await mountPage(UserCreatePage, '/admin/users/create')
      await t(w, 'user-role').setValue('school_admin')
      await t(w, 'gen-search').setValue('SEKOLAH')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      await t(w, 'gen-result').trigger('click')
      await t(w, 'gen-generate').trigger('click')
      await flushPromises()
      expect(has(w, 'gen-box')).toBe(true)
      expect(has(w, 'gen-password')).toBe(false)
      await t(w, 'user-form').trigger('submit')
      await flushPromises()
      const sent = users.createAdminUser.mock.calls[0]?.[0] as Record<string, unknown>
      expect(sent).not.toHaveProperty('password')
      expect(users.fetchAdminDefaults).not.toHaveBeenCalled()
      expect(t(w, 'credential-password').text()).toBe(SECRET)
    } finally {
      vi.useRealTimers()
    }
  })

  it('mock: keeps the password pair and fetches the defaults', async () => {
    mode.http = false
    const { w } = await mountPage(UserCreatePage, '/admin/users/create')
    await t(w, 'user-role').setValue('teacher')
    expect(has(w, 'user-password')).toBe(true)
    expect(users.fetchAdminDefaults).toHaveBeenCalled()
  })
})

describe('Edit Pengguna (S3)', () => {
  async function edit() {
    users.fetchAdminUser.mockResolvedValue(detail())
    return mountPage(UserEditPage, '/admin/users/7/edit', { id: 7 })
  }

  it('http: a multi-role user keeps every role on save and no password pair is sent', async () => {
    users.updateAdminUser.mockResolvedValue({
      data: detail(),
      status: 'Pengguna berjaya dikemaskini.',
    })
    const { w, router } = await edit()
    expect((t(w, 'user-role').element as HTMLSelectElement).value).toBe('school_admin')
    expect(has(w, 'user-new-password')).toBe(false)
    await w.get('form').trigger('submit')
    await flushPromises()
    const sent = users.updateAdminUser.mock.calls[0]?.[1] as Record<string, unknown>
    expect(sent.roles).toEqual(['school_admin', 'teacher'])
    expect(sent).not.toHaveProperty('newPassword')
    expect(sent).not.toHaveProperty('resetPassword')
    expect(router.currentRoute.value.path).toBe('/admin/users')
  })

  it('http: changing the shown role swaps only that role', async () => {
    users.updateAdminUser.mockResolvedValue({ data: detail(), status: 'ok' })
    const { w } = await edit()
    await t(w, 'user-role').setValue('ppd_officer')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect((users.updateAdminUser.mock.calls[0]?.[1] as { roles: string[] }).roles).toEqual([
      'ppd_officer',
      'teacher',
    ])
  })

  it('http: the reset switch sends resetPassword and shows the returned password once', async () => {
    users.updateAdminUser.mockResolvedValue({
      data: { ...detail(), generatedPassword: SECRET },
      status: 'Pengguna berjaya dikemaskini.',
    })
    const { w, router } = await edit()
    await t(w, 'user-reset-password').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    const sent = users.updateAdminUser.mock.calls[0]?.[1] as Record<string, unknown>
    expect(sent.resetPassword).toBe(true)
    expect(t(w, 'credential-password').text()).toBe(SECRET)
    expect(has(w, 'user-form')).toBe(false)
    expect(router.currentRoute.value.path).toBe('/admin/users/7/edit')
  })

  it('mock: keeps the new-password fields and the single role', async () => {
    mode.http = false
    users.fetchAdminUser.mockResolvedValue(detail({ roles: undefined }))
    users.updateAdminUser.mockResolvedValue({ data: detail(), status: 'ok' })
    const { w } = await mountPage(UserEditPage, '/admin/users/7/edit', { id: 7 })
    expect(has(w, 'user-new-password')).toBe(true)
    expect(has(w, 'user-reset-password')).toBe(false)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(users.updateAdminUser.mock.calls[0]?.[1]).not.toHaveProperty('roles')
  })
})

describe('Import Pengguna Pukal (S4)', () => {
  it('http: no default-password field or call; shows the per-row credentials', async () => {
    vi.useFakeTimers()
    try {
      imports.importUsers.mockResolvedValue({
        data: {
          created: 2,
          skipped: 0,
          failed: 0,
          errors: [],
          credentials: [
            { line: 1, email: 'a@example.test', generatedPassword: SECRET },
            { line: 2, email: 'b@example.test', generatedPassword: 'Terjana-Rahsia-2' },
          ],
        },
        status: 'Import selesai: 2 pengguna didaftarkan, 0 dilangkau, 0 gagal.',
      })
      const { w } = await mountPage(BulkImportPage, '/admin/users/bulk-import')
      expect(has(w, 'bulk-default-password')).toBe(false)
      expect(w.text()).not.toContain('pass123')
      await w.get('button[role=radio][value=parent]').trigger('click')
      await t(w, 'import-paste').setValue('A, a@example.test\nB, b@example.test')
      await t(w, 'bulk-form').trigger('submit')
      await flushPromises()
      const sent = imports.importUsers.mock.calls[0]?.[0] as Record<string, unknown>
      expect(sent).not.toHaveProperty('defaultPassword')
      expect(users.fetchAdminDefaults).not.toHaveBeenCalled()
      const rows = w.findAll('[data-testid=credential-row]')
      expect(rows).toHaveLength(2)
      expect(rows[0]?.get('[data-testid=credential-row-password]').text()).toBe(SECRET)
      expect(rows[1]?.get('[data-testid=credential-row-email]').text()).toBe('b@example.test')
    } finally {
      vi.useRealTimers()
    }
  })

  it('mock: keeps the default-password field and the defaults call', async () => {
    mode.http = false
    const { w } = await mountPage(BulkImportPage, '/admin/users/bulk-import')
    expect(has(w, 'bulk-default-password')).toBe(true)
    expect(users.fetchAdminDefaults).toHaveBeenCalled()
  })
})

describe('Daftar Pelajar Komplimen (S7)', () => {
  it('http: no defaults call and no default-password text', async () => {
    const { w } = await mountPage(CompStudentCreatePage, '/admin/comp-students/create')
    expect(users.fetchAdminDefaults).not.toHaveBeenCalled()
    expect(has(w, 'comp-info-password')).toBe(false)
    expect(t(w, 'comp-info').text()).not.toContain('kata laluan')
    expect(t(w, 'comp-info').text()).toContain('pakej penuh percuma')
  })

  it('mock: keeps the configured password in the info alert', async () => {
    mode.http = false
    const { w } = await mountPage(CompStudentCreatePage, '/admin/comp-students/create')
    expect(users.fetchAdminDefaults).toHaveBeenCalled()
    expect(t(w, 'comp-info-password').text()).toBe('c')
  })
})

const roleValues = (w: VueWrapper) =>
  (t(w, 'user-role').findAll('option') as { element: Element }[]).map(
    (o) => (o.element as HTMLOptionElement).value,
  )

describe('Peranan select (DV-M02-23)', () => {
  it('http: S2 and S3 leave out "Pegawai JPN" (not a contract role)', async () => {
    const create = await mountPage(UserCreatePage, '/admin/users/create')
    expect(roleValues(create.w)).not.toContain('jpn_officer')
    expect(roleValues(create.w)).toContain('ppd_officer')
    expect(create.w.text()).not.toContain('Pegawai JPN')
    users.fetchAdminUser.mockResolvedValue(detail())
    const edit = await mountPage(UserEditPage, '/admin/users/7/edit', { id: 7 })
    expect(roleValues(edit.w)).not.toContain('jpn_officer')
    expect(roleValues(edit.w)).toContain('school_admin')
  })

  it('mock: S2 keeps "Pegawai JPN"', async () => {
    mode.http = false
    const { w } = await mountPage(UserCreatePage, '/admin/users/create')
    expect(roleValues(w)).toContain('jpn_officer')
  })
})

describe('Pautkan Anak search minimum (DV-M02-24)', () => {
  async function searchFor(term: string) {
    const { w } = await mountPage(UserCreatePage, '/admin/users/create')
    await t(w, 'user-role').setValue('parent')
    await t(w, 'linker-search').trigger('focus')
    await t(w, 'linker-search').setValue(term)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    return w
  }

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('http: 2 characters search nothing and show no "Tiada pelajar dijumpai"; 3 search', async () => {
    const w = await searchFor('pe')
    expect(users.searchStudents).not.toHaveBeenCalled()
    expect(has(w, 'linker-empty')).toBe(false)
    await t(w, 'linker-search').setValue('pel')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(users.searchStudents).toHaveBeenCalledWith('pel', expect.anything())
    expect(has(w, 'linker-empty')).toBe(true)
  })

  it('mock: 2 characters still search', async () => {
    mode.http = false
    await searchFor('pe')
    expect(users.searchStudents).toHaveBeenCalledWith('pe', expect.anything())
  })
})
