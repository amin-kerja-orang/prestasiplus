// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { AdminEducationLevelListItem, AdminSubject } from '../../api/admin-subjects-levels'
import SubjectFormPage from '../../pages/SubjectFormPage.vue'

const api = vi.hoisted(() => ({
  fetchAdminLevels: vi.fn(),
  fetchAdminSubject: vi.fn(),
  createSubject: vi.fn(),
  updateSubject: vi.fn(),
}))
vi.mock('../../api/admin-subjects-levels', () => api)

function levels(): AdminEducationLevelListItem[] {
  return [1, 2, 3].map((id) => ({
    id,
    code: `D${String(id)}`,
    name: `Darjah ${String(id)}`,
    nameEn: `Year ${String(id)}`,
    stage: 'primary' as const,
    curriculum: 'KSSR',
    order: id,
    isActive: true,
    grade: id,
    createdAt: '',
    updatedAt: '',
    questionCount: 0,
    subjectCount: 0,
  }))
}

const SUBJECT: AdminSubject = {
  id: 3,
  code: 'MATH',
  name: 'Matematik',
  nameEn: 'Mathematics',
  icon: 'calculator',
  color: '#EF4444',
  isCore: true,
  order: 3,
  isActive: true,
  educationLevelIds: [1, 3],
  createdAt: '',
  updatedAt: '',
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(mode: 'create' | 'edit', id = 3): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/subjects', component: { template: '<div />' } },
      { path: '/form', component: SubjectFormPage },
    ],
  })
  await router.push('/form')
  wrapper = mount(SubjectFormPage, { props: { mode, id }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

function t(w: VueWrapper, id: string) {
  return w.get(`[data-testid=${id}]`)
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchAdminLevels.mockResolvedValue({
    data: levels(),
    meta: { page: 1, pageSize: 3, totalItems: 3, totalPages: 1, from: 1, to: 3 },
  })
  api.fetchAdminSubject.mockResolvedValue(SUBJECT)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('SubjectFormPage create (M03 S7)', () => {
  it('shows the labels, placeholders, defaults and hints', async () => {
    const w = await render('create')
    expect(t(w, 'subject-back').text()).toBe('Kembali ke Senarai')
    expect(t(w, 'subject-back').attributes('href')).toBe('/admin/subjects')
    expect(t(w, 'subject-name').attributes('placeholder')).toBe('cth: Matematik')
    expect(t(w, 'subject-name-en').attributes('placeholder')).toBe('e.g: Mathematics')
    const code = t(w, 'subject-code')
    expect(code.attributes('placeholder')).toBe('cth: MATH01')
    expect(code.attributes('maxlength')).toBe('20')
    expect(code.classes()).toEqual(expect.arrayContaining(['uppercase', 'font-mono']))
    expect((t(w, 'subject-icon-input').element as HTMLInputElement).value).toBe('fas fa-book')
    expect(t(w, 'subject-icon-input').attributes('placeholder')).toBe('cth: fas fa-calculator')
    expect(t(w, 'subject-icon-link').attributes('href')).toBe('https://fontawesome.com/icons')
    expect(t(w, 'subject-icon-link').attributes('target')).toBe('_blank')
    expect((t(w, 'subject-color-text').element as HTMLInputElement).value).toBe('#4f46e5')
    expect((t(w, 'subject-core').element as HTMLInputElement).checked).toBe(false)
    expect((t(w, 'subject-order').element as HTMLInputElement).value).toBe('0')
    expect(t(w, 'subject-order').attributes('min')).toBe('0')
    expect(w.text()).toContain('Kod akan ditukar ke huruf besar automatik')
    expect(w.text()).toContain('Tandakan jika subjek ini adalah subjek wajib')
    expect(w.text()).toContain('Nombor lebih kecil akan dipaparkan dahulu')
    expect(t(w, 'form-submit').text()).toBe('Simpan Subjek')
    expect(t(w, 'form-cancel').text()).toBe('Batal')
  })

  it('lists one unticked checkbox per level labelled "name (nameEn)" in a scroll box', async () => {
    const w = await render('create')
    const options = w.findAll('[data-testid=subject-level-option]')
    expect(options).toHaveLength(3)
    expect(options.every((o) => !(o.element as HTMLInputElement).checked)).toBe(true)
    expect(w.findAll('label span').map((s) => s.text())).toContain('Darjah 1 (Year 1)')
    expect(t(w, 'subject-levels-box').classes()).toEqual(
      expect.arrayContaining(['max-h-64', 'overflow-y-auto']),
    )
  })

  it('mirrors the colour picker into the read-only text', async () => {
    const w = await render('create')
    await t(w, 'subject-color').setValue('#00ff00')
    expect((t(w, 'subject-color-text').element as HTMLInputElement).value).toBe('#00ff00')
    expect(t(w, 'subject-color-text').attributes('readonly')).toBeDefined()
  })

  it('has no "Aktif" field', async () => {
    const w = await render('create')
    expect(w.text()).not.toContain('Aktif')
  })

  it('posts the body, queues the flash and returns to the list', async () => {
    api.createSubject.mockResolvedValue({ data: SUBJECT, status: 'Subjek berjaya ditambah.' })
    const w = await render('create')
    await t(w, 'subject-name').setValue('Sains Demo')
    await t(w, 'subject-name-en').setValue('Demo Science')
    await t(w, 'subject-code').setValue('DEMO01')
    const boxes = w.findAll('[data-testid=subject-level-option]')
    await boxes[1]?.setValue(true)
    await boxes[0]?.setValue(true)
    await t(w, 'subject-form').trigger('submit')
    await flushPromises()
    expect(api.createSubject).toHaveBeenCalledWith({
      name: 'Sains Demo',
      nameEn: 'Demo Science',
      code: 'DEMO01',
      icon: 'fas fa-book',
      color: '#4f46e5',
      isCore: false,
      order: 0,
      educationLevelIds: [1, 2],
    })
    expect(router.currentRoute.value.path).toBe('/admin/subjects')
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Subjek berjaya ditambah.',
    })
  })

  it('shows the server message in the red box and keeps the input', async () => {
    api.createSubject.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Invalid',
        fields: { code: 'The code has already been taken.' },
      }),
    )
    const w = await render('create')
    await t(w, 'subject-name').setValue('X')
    await t(w, 'subject-name-en').setValue('X')
    await t(w, 'subject-code').setValue('MATH')
    await t(w, 'subject-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'subject-form-alert').text()).toContain('The code has already been taken.')
    expect(router.currentRoute.value.path).toBe('/form')
    expect((t(w, 'subject-code').element as HTMLInputElement).value).toBe('MATH')
    expect(t(w, 'subject-code').classes()).not.toContain('border-red-400')
  })
})

describe('SubjectFormPage edit (M03 S8)', () => {
  it('pre-fills the stored values and ticks the linked levels', async () => {
    const w = await render('edit')
    expect(api.fetchAdminSubject).toHaveBeenCalledWith(3, expect.anything())
    expect((t(w, 'subject-name').element as HTMLInputElement).value).toBe('Matematik')
    expect((t(w, 'subject-code').element as HTMLInputElement).value).toBe('MATH')
    expect((t(w, 'subject-icon-input').element as HTMLInputElement).value).toBe('calculator')
    expect((t(w, 'subject-color-text').element as HTMLInputElement).value).toBe('#EF4444')
    expect((t(w, 'subject-core').element as HTMLInputElement).checked).toBe(true)
    expect((t(w, 'subject-order').element as HTMLInputElement).value).toBe('3')
    const ticked = w
      .findAll('[data-testid=subject-level-option]')
      .map((o) => (o.element as HTMLInputElement).checked)
    expect(ticked).toEqual([true, false, true])
    expect(t(w, 'form-submit').text()).toBe('Kemaskini Subjek')
  })

  it('PUTs the changed levels and returns to the list with the flash', async () => {
    api.updateSubject.mockResolvedValue({ data: SUBJECT, status: 'Subjek berjaya dikemaskini.' })
    const w = await render('edit')
    await w.findAll('[data-testid=subject-level-option]')[0]?.setValue(false)
    await t(w, 'subject-form').trigger('submit')
    await flushPromises()
    expect(api.updateSubject).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ educationLevelIds: [3], color: '#EF4444', isCore: true }),
    )
    expect(router.currentRoute.value.path).toBe('/admin/subjects')
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Subjek berjaya dikemaskini.',
    })
  })

  it('goes back to the list with "Subjek tidak dijumpai." for an unknown id', async () => {
    api.fetchAdminSubject.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    await render('edit', 999)
    expect(router.currentRoute.value.path).toBe('/admin/subjects')
    expect(useFlashStore().pending).toEqual({
      type: 'error',
      message: 'Subjek tidak dijumpai.',
    })
  })

  it('shows the placeholder load error for another failure', async () => {
    api.fetchAdminSubject.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render('edit')
    expect(t(w, 'subject-load-error').text()).toContain('Ralat memuatkan data. Sila cuba semula.')
    expect(w.find('[data-testid=subject-form]').exists()).toBe(false)
  })
})
