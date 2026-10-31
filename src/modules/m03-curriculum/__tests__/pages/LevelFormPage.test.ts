// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { AdminEducationLevel } from '../../api/admin-subjects-levels'
import LevelFormPage from '../../pages/LevelFormPage.vue'

const api = vi.hoisted(() => ({
  fetchAdminLevel: vi.fn(),
  createLevel: vi.fn(),
  updateLevel: vi.fn(),
}))
vi.mock('../../api/admin-subjects-levels', () => api)

const LEVEL: AdminEducationLevel = {
  id: 10,
  code: 'T4',
  name: 'Tingkatan 4',
  nameEn: 'Form 4',
  stage: 'upper_secondary',
  curriculum: 'KSSM',
  order: 10,
  isActive: true,
  grade: 10,
  createdAt: '',
  updatedAt: '',
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(mode: 'create' | 'edit', id = 10): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/education-levels', component: { template: '<div />' } },
      { path: '/form', component: LevelFormPage },
    ],
  })
  await router.push('/form')
  wrapper = mount(LevelFormPage, { props: { mode, id }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

function t(w: VueWrapper, id: string) {
  return w.get(`[data-testid=${id}]`)
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchAdminLevel.mockResolvedValue(LEVEL)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('LevelFormPage create (M03 S10)', () => {
  it('shows the labels, placeholders, stage options, hints and the pink submit', async () => {
    const w = await render('create')
    expect(t(w, 'level-back').text()).toBe('Kembali ke Senarai')
    expect(t(w, 'level-back').attributes('href')).toBe('/admin/education-levels')
    expect(t(w, 'level-name').attributes('placeholder')).toBe('cth: Tingkatan 1')
    expect(t(w, 'level-name-en').attributes('placeholder')).toBe('e.g: Form 1')
    expect(t(w, 'level-code').attributes('placeholder')).toBe('cth: T1')
    expect(t(w, 'level-code').attributes('maxlength')).toBe('10')
    expect(t(w, 'level-curriculum').attributes('placeholder')).toBe('cth: KSSR, KSSM')
    expect(w.findAll('[data-testid=level-stage] option').map((o) => o.text())).toEqual([
      '-- Pilih Peringkat --',
      'Menengah Rendah (Lower Secondary)',
      'Menengah Atas (Upper Secondary)',
    ])
    expect((t(w, 'level-order').element as HTMLInputElement).value).toBe('0')
    expect(w.text()).toContain('Nama kurikulum yang diguna pakai')
    expect(t(w, 'form-submit').text()).toBe('Simpan Tahap')
    expect(w.text()).not.toContain('Aktif')
  })

  it('posts the body, queues the flash and returns to the list', async () => {
    api.createLevel.mockResolvedValue({ data: LEVEL, status: 'Tahap Pendidikan berjaya ditambah.' })
    const w = await render('create')
    await t(w, 'level-name').setValue('Tingkatan Demo')
    await t(w, 'level-name-en').setValue('Demo Form')
    await t(w, 'level-code').setValue('yd')
    await t(w, 'level-stage').setValue('lower_secondary')
    await t(w, 'level-curriculum').setValue('KSSM')
    await t(w, 'level-form').trigger('submit')
    await flushPromises()
    expect(api.createLevel).toHaveBeenCalledWith({
      name: 'Tingkatan Demo',
      nameEn: 'Demo Form',
      code: 'yd',
      stage: 'lower_secondary',
      curriculum: 'KSSM',
      order: 0,
    })
    expect(router.currentRoute.value.path).toBe('/admin/education-levels')
    expect(useFlashStore().pending?.message).toBe('Tahap Pendidikan berjaya ditambah.')
  })

  it('does not post while no stage is chosen', async () => {
    const w = await render('create')
    await t(w, 'level-form').trigger('submit')
    await flushPromises()
    expect(api.createLevel).not.toHaveBeenCalled()
  })

  it('shows server messages in the red box and keeps the input', async () => {
    api.createLevel.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Invalid',
        fields: { code: 'The code has already been taken.' },
      }),
    )
    const w = await render('create')
    await t(w, 'level-name').setValue('A')
    await t(w, 'level-name-en').setValue('A')
    await t(w, 'level-code').setValue('D1')
    await t(w, 'level-stage').setValue('lower_secondary')
    await t(w, 'level-curriculum').setValue('KSSM')
    await t(w, 'level-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'level-form-alert').text()).toContain('The code has already been taken.')
    expect((t(w, 'level-code').element as HTMLInputElement).value).toBe('D1')
    expect(router.currentRoute.value.path).toBe('/form')
  })
})

describe('LevelFormPage edit (M03 S11)', () => {
  it('pre-fills level 10', async () => {
    const w = await render('edit')
    expect((t(w, 'level-name').element as HTMLInputElement).value).toBe('Tingkatan 4')
    expect((t(w, 'level-name-en').element as HTMLInputElement).value).toBe('Form 4')
    expect((t(w, 'level-code').element as HTMLInputElement).value).toBe('T4')
    expect((t(w, 'level-stage').element as HTMLSelectElement).value).toBe('upper_secondary')
    expect((t(w, 'level-curriculum').element as HTMLInputElement).value).toBe('KSSM')
    expect((t(w, 'level-order').element as HTMLInputElement).value).toBe('10')
    expect(t(w, 'form-submit').text()).toBe('Kemaskini Tahap')
  })

  it('PUTs the change and returns to the list', async () => {
    api.updateLevel.mockResolvedValue({
      data: LEVEL,
      status: 'Tahap Pendidikan berjaya dikemaskini.',
    })
    const w = await render('edit')
    await t(w, 'level-curriculum').setValue('KSSM-X')
    await t(w, 'level-form').trigger('submit')
    await flushPromises()
    expect(api.updateLevel).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ curriculum: 'KSSM-X', stage: 'upper_secondary', order: 10 }),
    )
    expect(router.currentRoute.value.path).toBe('/admin/education-levels')
  })

  it('goes back with "Tahap Pendidikan tidak dijumpai." for an unknown id', async () => {
    api.fetchAdminLevel.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    await render('edit', 999)
    expect(router.currentRoute.value.path).toBe('/admin/education-levels')
    expect(useFlashStore().pending).toEqual({
      type: 'error',
      message: 'Tahap Pendidikan tidak dijumpai.',
    })
  })
})
