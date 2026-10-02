// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome, setRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables'
import { useFlashStore } from '@/stores/flash'

import type { AdminSchool } from '../../api/schools-admin'
import SchoolFormPage from '../../pages/SchoolFormPage.vue'

const api = vi.hoisted(() => ({
  createSchool: vi.fn(),
  updateSchool: vi.fn(),
  fetchAdminSchool: vi.fn(),
}))
vi.mock('../../api/schools-admin', () => api)

const SCHOOL: AdminSchool = {
  id: 42,
  name: 'SK TAMAN CONTOH',
  code: 'ABC1042',
  type: 'SK',
  state: 'Selangor',
  district: 'PPD CONTOH',
  city: 'BANDAR CONTOH',
  isActive: false,
  createdAt: '2026-01-01T00:00:00+08:00',
  updatedAt: '2026-01-01T00:00:00+08:00',
  studentCount: 0,
  teacherCount: 0,
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(props: { mode: 'create' | 'edit'; id?: number }): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/schools', component: { template: '<div />' } },
      { path: '/form', component: SchoolFormPage },
    ],
  })
  await router.push('/form')
  wrapper = mount(SchoolFormPage, { props, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

async function fillRequired(w: VueWrapper): Promise<void> {
  await w.get('[data-testid=school-name]').setValue('  SK TAMAN BARU ')
  await w.get('[data-testid=school-code]').setValue('JBA1234')
  await w.get('[data-testid=school-type]').setValue('SJK(C)')
  await w.get('[data-testid=school-state]').setValue('Johor')
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.createSchool.mockReset()
  api.updateSchool.mockReset()
  api.fetchAdminSchool.mockReset()
  api.fetchAdminSchool.mockResolvedValue(SCHOOL)
  usePageMeta().reset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('SchoolFormPage create (M02 S10)', () => {
  it('shows the fields, placeholders, options and the switch on by default', async () => {
    const w = await render({ mode: 'create' })
    expect(w.get('[data-testid=school-back]').text()).toBe('Kembali ke Senarai Sekolah')
    expect(w.get('label[for=school-name]').text()).toBe('Nama Sekolah *')
    expect(w.get('[data-testid=school-name]').attributes('placeholder')).toBe(
      'cth: SK TAMAN KLUANG BARU',
    )
    expect(w.get('[data-testid=school-code]').attributes('placeholder')).toBe('cth: JBA1234')
    expect(w.get('[data-testid=school-district]').attributes('placeholder')).toBe('cth: KLUANG')
    expect(w.get('[data-testid=school-city]').attributes('placeholder')).toBe('cth: KLUANG')
    for (const id of ['school-name', 'school-code', 'school-type', 'school-state']) {
      expect(w.get(`[data-testid=${id}]`).attributes('required')).toBeDefined()
    }
    expect(w.get('[data-testid=school-district]').attributes('required')).toBeUndefined()
    expect(w.findAll('[data-testid=school-type] option').map((o) => o.text())).toEqual([
      'Pilih jenis',
      'SK',
      'SMK',
      'SJK(C)',
      'SJK(T)',
      'MRSM',
      'SBP',
    ])
    const states = w.findAll('[data-testid=school-state] option').map((o) => o.text())
    expect(states).toHaveLength(17)
    expect(states[0]).toBe('Pilih negeri')
    expect((w.get('[data-testid=school-active]').element as HTMLInputElement).checked).toBe(true)
    expect(w.get('[data-testid=school-submit]').text()).toBe('Simpan')
    expect(w.get('[data-testid=school-cancel]').attributes('href')).toBe('/admin/schools')
    expect(w.find('form').attributes('novalidate')).toBeUndefined()
    expect(api.fetchAdminSchool).not.toHaveBeenCalled()
  })

  it('creates the school, queues the flash and goes back to the list', async () => {
    api.createSchool.mockResolvedValue({ data: SCHOOL, status: 'Sekolah berjaya disimpan.' })
    const w = await render({ mode: 'create' })
    await fillRequired(w)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.createSchool).toHaveBeenCalledWith({
      name: '  SK TAMAN BARU ',
      code: 'JBA1234',
      type: 'SJK(C)',
      state: 'Johor',
      district: '',
      city: '',
      isActive: true,
    })
    expect(router.currentRoute.value.path).toBe('/admin/schools')
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Sekolah berjaya disimpan.',
    })
  })

  it('keeps the input and shows a duplicate-code error in the alert and under the field', async () => {
    api.createSchool.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'The code has already been taken.',
        fields: { code: 'The code has already been taken.' },
      }),
    )
    const w = await render({ mode: 'create' })
    await fillRequired(w)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid=school-form-alert]').text()).toContain(
      'The code has already been taken.',
    )
    expect(w.get('[data-testid=school-code]').classes()).toContain('border-red-400')
    expect(w.text()).toContain('The code has already been taken.')
    expect((w.get('[data-testid=school-code]').element as HTMLInputElement).value).toBe('JBA1234')
    expect(router.currentRoute.value.path).toBe('/form')
  })
})

describe('SchoolFormPage edit (M02 S11)', () => {
  it('pre-fills from the school, shows "Kemaskini" and sets the header subtitle', async () => {
    const w = await render({ mode: 'edit', id: 42 })
    expect(api.fetchAdminSchool).toHaveBeenCalledWith(42, expect.anything())
    expect((w.get('[data-testid=school-name]').element as HTMLInputElement).value).toBe(
      'SK TAMAN CONTOH',
    )
    expect((w.get('[data-testid=school-code]').element as HTMLInputElement).value).toBe('ABC1042')
    expect((w.get('[data-testid=school-type]').element as HTMLSelectElement).value).toBe('SK')
    expect((w.get('[data-testid=school-state]').element as HTMLSelectElement).value).toBe(
      'Selangor',
    )
    expect((w.get('[data-testid=school-active]').element as HTMLInputElement).checked).toBe(false)
    expect(w.get('[data-testid=school-submit]').text()).toBe('Kemaskini')
    expect(usePageMeta().state.header).toEqual({
      title: 'Edit Sekolah',
      subtitle: 'SK TAMAN CONTOH',
    })
  })

  it('updates the school with the edited values', async () => {
    api.updateSchool.mockResolvedValue({ data: SCHOOL, status: 'Sekolah berjaya disimpan.' })
    const w = await render({ mode: 'edit', id: 42 })
    await w.get('[data-testid=school-district]').setValue('PPD LAIN')
    await w.get('[data-testid=school-active]').setValue(true)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateSchool).toHaveBeenCalledWith(42, {
      name: 'SK TAMAN CONTOH',
      code: 'ABC1042',
      type: 'SK',
      state: 'Selangor',
      district: 'PPD LAIN',
      city: 'BANDAR CONTOH',
      isActive: true,
    })
    expect(router.currentRoute.value.path).toBe('/admin/schools')
  })

  it('sets the standard 404 outcome when the school is unknown', async () => {
    setRouteOutcome(null)
    api.fetchAdminSchool.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Sekolah tidak dijumpai.' }),
    )
    const w = await render({ mode: 'edit', id: 999 })
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-testid=school-load-error]').exists()).toBe(false)
    expect(w.find('[data-testid=school-form]').exists()).toBe(false)
    setRouteOutcome(null)
  })

  it('keeps the red box with a retry for a non-404 load failure', async () => {
    setRouteOutcome(null)
    api.fetchAdminSchool.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render({ mode: 'edit', id: 42 })
    expect(useRouteOutcome().value).toBeNull()
    expect(w.get('[data-testid=school-load-error]').text()).toContain('Ralat berlaku')
    expect(w.find('[data-testid=school-form]').exists()).toBe(false)
  })

  it('shows a skeleton while the school loads', async () => {
    api.fetchAdminSchool.mockReturnValue(new Promise(() => undefined))
    const w = await render({ mode: 'edit', id: 42 })
    expect(w.find('[data-testid=school-form-skeleton]').exists()).toBe(true)
    expect(w.find('[data-testid=school-form]').exists()).toBe(false)
  })
})
