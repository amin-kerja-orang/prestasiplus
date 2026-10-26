// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import CompStudentCreatePage from '../../pages/CompStudentCreatePage.vue'
import { expectOneColumnBelowMd } from './form-columns'

const api = vi.hoisted(() => ({
  fetchTeachers: vi.fn(),
  fetchTeacherClassrooms: vi.fn(),
  registerCompStudents: vi.fn(),
}))
const users = vi.hoisted(() => ({ fetchAdminDefaults: vi.fn() }))
vi.mock('../../api/comp-students', () => api)
vi.mock('../../api/users', () => users)

let wrapper: VueWrapper | null = null
let router: Router

async function render(): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/comp-students', component: stub },
      { path: '/admin/comp-students/create', component: CompStudentCreatePage },
    ],
  })
  await router.push('/admin/comp-students/create')
  wrapper = mount(CompStudentCreatePage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

async function pickTeacher(w: VueWrapper, id: string): Promise<void> {
  await t(w, 'comp-teacher').setValue(id)
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchTeachers.mockReset().mockResolvedValue([
    { id: 7, name: 'GURU DEMO SATU', email: 'guru1@demo.test' },
    { id: 8, name: 'GURU DEMO DUA', email: 'guru2@demo.test' },
  ])
  api.fetchTeacherClassrooms
    .mockReset()
    .mockResolvedValue([{ id: 31, name: '5 BESTARI', classCode: 'DMO201' }])
  api.registerCompStudents.mockReset()
  users.fetchAdminDefaults.mockReset().mockResolvedValue({
    schoolAdminDefaultPassword: 'a',
    bulkImportDefaultPassword: 'b',
    compStudentDefaultPassword: '20262026',
  })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-25T12:00:00+08:00'))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('CompStudentCreatePage (M02 S7) content', () => {
  it('shows the info alert with the configured password, the fields, help, placeholder, link and submit', async () => {
    const w = await render()
    expect(t(w, 'comp-info').text().replace(/\s+/g, ' ')).toBe(
      'Setiap pelajar dapat: username 6 digit akhir IC@prestasiplus.my, kata laluan 20262026, pakej penuh percuma, dan syiling dimatikan (tak boleh kumpul/claim walaupun jawab soalan / main game).',
    )
    expect(w.findAll('label').map((l) => l.text())).toEqual([
      'Guru',
      'Kelas guru',
      'Tarikh tamat pakej',
      'Senarai pelajar',
    ])
    expect(
      t(w, 'comp-teacher')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual([
      '— Pilih guru —',
      'GURU DEMO SATU (guru1@demo.test)',
      'GURU DEMO DUA (guru2@demo.test)',
    ])
    expect(t(w, 'comp-class').attributes('disabled')).toBeDefined()
    expect(t(w, 'comp-class').attributes('required')).toBeDefined()
    expect(w.find('[data-testid=comp-no-class]').exists()).toBe(false)
    expect((t(w, 'comp-expiry').element as HTMLInputElement).value).toBe('2026-12-31')
    expect(t(w, 'comp-students').attributes('rows')).toBe('8')
    expect(t(w, 'comp-students').attributes('required')).toBeDefined()
    expect(t(w, 'comp-students').attributes('placeholder')).toBe(
      'NAMA PENUH, NOMBOR KP\nNAMA PENUH, NOMBOR KP',
    )
    expect(t(w, 'comp-help').text()).toBe(
      'Satu pelajar setiap baris, format: NAMA, NOKP (cth: MUHAMMAD FULAN BIN FULAN, 090101101234)',
    )
    expect(t(w, 'form-cancel').attributes('href')).toBe('/admin/comp-students')
    expect(t(w, 'form-cancel').text()).toBe('Senarai pelajar komplimen')
    expect(t(w, 'form-submit').text()).toBe('Daftar Pelajar Komplimen')
  })
})

describe('CompStudentCreatePage (M02 S7) teacher and classes', () => {
  it('choosing a teacher loads and enables the classes, changing it clears the class', async () => {
    const w = await render()
    await pickTeacher(w, '7')
    expect(api.fetchTeacherClassrooms).toHaveBeenCalledWith(7, expect.anything())
    expect(t(w, 'comp-class').attributes('disabled')).toBeUndefined()
    expect(
      t(w, 'comp-class')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['— Pilih kelas —', '5 BESTARI (DMO201)'])
    await t(w, 'comp-class').setValue('31')
    api.fetchTeacherClassrooms.mockResolvedValue([])
    await pickTeacher(w, '8')
    expect((t(w, 'comp-class').element as HTMLSelectElement).value).toBe('')
    expect(t(w, 'comp-no-class').text()).toBe('Guru ini tiada kelas aktif.')
    await pickTeacher(w, '')
    expect(t(w, 'comp-class').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid=comp-no-class]').exists()).toBe(false)
  })

  it('a failed class load reads as no classes and logs to the console', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.fetchTeacherClassrooms.mockRejectedValue(new Error('boom'))
    const w = await render()
    await pickTeacher(w, '7')
    expect(w.find('[data-testid=comp-no-class]').exists()).toBe(true)
    expect(spy).toHaveBeenCalledWith('[comp-students] load classrooms failed', expect.any(Error))
    spy.mockRestore()
  })
})

describe('CompStudentCreatePage (M02 S7) submit', () => {
  async function fill(w: VueWrapper): Promise<void> {
    await pickTeacher(w, '7')
    await t(w, 'comp-class').setValue('31')
    await t(w, 'comp-students').setValue('PELAJAR DEMO SATU BIN DEMO, 090101101234')
  }

  it('registers, flashes the status only, and goes to the list', async () => {
    api.registerCompStudents.mockResolvedValue({
      data: {
        created: 1,
        skipped: 0,
        failed: 1,
        errors: [{ line: 2, message: 'No. KP tidak sah.' }],
      },
      status: '1 pelajar komplimen berjaya didaftarkan.',
    })
    const w = await render()
    await fill(w)
    await t(w, 'comp-form').trigger('submit')
    await flushPromises()
    expect(api.registerCompStudents).toHaveBeenCalledWith({
      classroomId: 31,
      packageExpiresAt: '2026-12-31',
      students: 'PELAJAR DEMO SATU BIN DEMO, 090101101234',
    })
    expect(router.currentRoute.value.path).toBe('/admin/comp-students')
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: '1 pelajar komplimen berjaya didaftarkan.',
    })
  })

  it('shows a refusal in the red alert and keeps the input', async () => {
    api.registerCompStudents.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'The given data was invalid.',
        fields: { classroomId: 'The selected classroom id is invalid.' },
      }),
    )
    const w = await render()
    await fill(w)
    await t(w, 'comp-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'comp-alert').text()).toContain('The selected classroom id is invalid.')
    expect(router.currentRoute.value.path).toBe('/admin/comp-students/create')
    expect((t(w, 'comp-students').element as HTMLTextAreaElement).value).toBe(
      'PELAJAR DEMO SATU BIN DEMO, 090101101234',
    )
    expect(useFlashStore().pending).toBeNull()
  })
})

describe('CompStudentCreatePage (M02 S7) one column below 768px (BUG-06, DV-M02-31)', () => {
  it('keeps the two-column grid for md and up only', async () => {
    const w = await render()
    expectOneColumnBelowMd(w)
  })
})
