// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'
import { useSessionStore } from '@/stores/session'

import type { SchoolSummary, UserMe } from '../../api'
import ProfileEditPage from '../../pages/ProfileEditPage.vue'
import ProfilePage from '../../pages/ProfilePage.vue'

const apiMocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  uploadPicture: vi.fn(),
  changePassword: vi.fn(),
  getSession: vi.fn(),
}))
vi.mock('../../api', () => apiMocks)

const searchSchools = vi.hoisted(() => vi.fn())
vi.mock('@/modules/m02-users-schools', () => ({ searchSchools }))

const SCHOOL: SchoolSummary = {
  id: 8101,
  name: 'SMK DEMO',
  code: 'ABA0001',
  type: 'SMK',
  state: 'Selangor',
  district: 'PPD PETALING UTAMA',
  city: 'Petaling Jaya',
}

const USER: UserMe = {
  id: 2,
  name: 'Pelajar Demo',
  email: 'pelajar@demo.test',
  phone: '0123456789',
  role: 'student',
  grade: 10,
  schoolId: SCHOOL.id,
  bio: 'Suka belajar',
  avatarUrl: null,
  createdAt: '2026-02-06T09:00:00+08:00',
  updatedAt: '2026-02-06T09:00:00+08:00',
  lastLoginAt: null,
  school: SCHOOL,
  landingPath: '/dashboard',
}

const blank = { template: '<div />' }
let wrapper: VueWrapper | null = null

async function render(
  component: object,
  user: UserMe = USER,
  refresh: Promise<UserMe | null> = Promise.resolve(null),
): Promise<VueWrapper> {
  const session = useSessionStore()
  session.setSession({
    token: 't',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user,
  })
  vi.spyOn(session, 'refreshUser').mockReturnValue(refresh)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/profile', component: ProfilePage },
      { path: '/profile/edit', component: ProfileEditPage },
      { path: '/:rest(.*)*', component: blank },
    ],
  })
  await router.push('/profile')
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

/** Reka controls have no native input: values are driven through the component. */
const groupOf = (w: VueWrapper) => w.findComponent({ name: 'RadioGroup' })
const selectOf = (w: VueWrapper) => w.findComponent({ name: 'Select' })
const checkedGrade = (w: VueWrapper) =>
  w
    .findAll('[data-testid=grade-grid] [role=radio]')
    .filter((r) => r.attributes('aria-checked') === 'true')

function apiError(fields: Record<string, string>): ApiError {
  return new ApiError({
    status: 422,
    code: 'VALIDATION_ERROR',
    message: Object.values(fields)[0] ?? '',
    fields,
  })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  for (const fn of Object.values(apiMocks)) fn.mockReset()
  searchSchools.mockReset()
  window.scrollTo = vi.fn()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('S7 /profile (FR-M01-38)', () => {
  it('shows the hero: name, email, "Ahli sejak" in BM and the edit pill', async () => {
    const w = await render(ProfilePage)
    expect(w.get('[data-testid=profile-name]').text()).toBe('Pelajar Demo')
    expect(w.get('[data-testid=profile-email]').text()).toBe('pelajar@demo.test')
    expect(w.get('[data-testid=profile-member-since]').text()).toBe('Ahli sejak 6 Februari 2026')
    expect(w.find('[data-testid=profile-crown]').exists()).toBe(true)
    const link = w.get('[data-testid=profile-edit-link]')
    expect(link.text()).toBe('Kemaskini Profil')
    expect(link.attributes('href')).toBe('/profile/edit')
  })

  it('uses the initials image without a picture and the uploaded picture otherwise', async () => {
    let w = await render(ProfilePage)
    // No picture: the avatar falls back to the user's initials.
    expect(w.find('img[data-testid=profile-avatar]').exists()).toBe(false)
    expect(w.get('[data-testid=profile-avatar]').text()).toBe('PD')
    w.unmount()
    w = await render(ProfilePage, { ...USER, avatarUrl: 'data:image/png;base64,AAAA' })
    expect(w.get('[data-testid=profile-avatar]').attributes('src')).toBe(
      'data:image/png;base64,AAAA',
    )
  })
})

describe('S8 /profile/edit personal card (FR-M01-39, 40, 44)', () => {
  it('pre-fills, disables the email and keeps the bio counter static', async () => {
    const w = await render(ProfileEditPage)
    expect((w.get('[data-testid=profile-name-input]').element as HTMLInputElement).value).toBe(
      'Pelajar Demo',
    )
    expect(w.get('[data-testid=profile-name-input]').attributes('required')).toBeDefined()
    const email = w.get('[data-testid=profile-email-input]')
    expect(email.attributes('disabled')).toBeDefined()
    expect(email.attributes('name')).toBeUndefined()
    expect(w.text()).toContain('Email tidak boleh diubah')
    expect(w.get('[data-testid=profile-phone-input]').attributes('placeholder')).toBe('012-3456789')
    expect(w.get('[data-testid=profile-bio-input]').attributes('maxlength')).toBe('500')
    expect(w.get('[data-testid=profile-bio-counter]').text()).toBe('Baki: 500 aksara')
    await w.get('[data-testid=profile-bio-input]').setValue('abc')
    expect(w.get('[data-testid=profile-bio-counter]').text()).toBe('Baki: 500 aksara')
  })

  it('shows Ting. 1-5 with Ting. 4 checked for grade 10', async () => {
    const w = await render(ProfileEditPage)
    const picker = w.get('[data-testid=grade-picker]')
    expect(picker.text()).toContain('Sekolah Menengah')
    expect(picker.findAll('[role=radio]')).toHaveLength(5)
    expect(checkedGrade(w)).toHaveLength(1)
    expect(checkedGrade(w)[0]?.attributes('value')).toBe('10')
  })

  it('shows Darjah 1-6 for a null grade and for grade 1-6', async () => {
    const w = await render(ProfileEditPage, { ...USER, role: 'admin', grade: null })
    expect(w.get('[data-testid=grade-picker]').text()).toContain('Sekolah Rendah')
    expect(w.findAll('[data-testid=grade-picker] [role=radio]')).toHaveLength(6)
    expect(checkedGrade(w)).toHaveLength(0)
  })

  it('saves name, phone, bio, grade and school, then shows the success flash', async () => {
    apiMocks.updateProfile.mockResolvedValue({
      data: { ...USER, name: 'Nama Baru', grade: 9 },
      status: 'Profil berjaya dikemaskini.',
    })
    const w = await render(ProfileEditPage)
    await w.get('[data-testid=profile-name-input]').setValue('Nama Baru')
    groupOf(w).vm.$emit('update:modelValue', 9)
    await flushPromises()
    await w.get('[data-testid=profile-form]').trigger('submit')
    await flushPromises()
    expect(apiMocks.updateProfile).toHaveBeenCalledWith({
      name: 'Nama Baru',
      phone: '0123456789',
      bio: 'Suka belajar',
      grade: 9,
      schoolId: SCHOOL.id,
    })
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Profil berjaya dikemaskini.',
    })
    expect(useSessionStore().user?.name).toBe('Nama Baru')
    expect((w.get('[data-testid=profile-name-input]').element as HTMLInputElement).value).toBe(
      'Nama Baru',
    )
  })

  it('sends null for an empty phone, bio and a cleared school', async () => {
    apiMocks.updateProfile.mockResolvedValue({ data: USER, status: 'ok' })
    const w = await render(ProfileEditPage)
    await w.get('[data-testid=profile-phone-input]').setValue('')
    await w.get('[data-testid=profile-bio-input]').setValue('')
    await w.get('[data-testid=school-clear]').trigger('click')
    await w.get('[data-testid=profile-form]').trigger('submit')
    await flushPromises()
    expect(apiMocks.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null, bio: null, schoolId: null }),
    )
  })

  it('shows a server error in the red flash and keeps the input', async () => {
    apiMocks.updateProfile.mockRejectedValue(apiError({ name: 'The name field is required.' }))
    const w = await render(ProfileEditPage)
    await w.get('[data-testid=profile-name-input]').setValue('   ')
    await w.get('[data-testid=profile-form]').trigger('submit')
    await flushPromises()
    expect(useFlashStore().current).toEqual({
      type: 'error',
      message: ['Ruang nama wajib diisi.'],
    })
    expect((w.get('[data-testid=profile-name-input]').element as HTMLInputElement).value).toBe(
      '   ',
    )
  })

  it('has "Kembali" to /profile and the "Simpan Profil" button', async () => {
    const w = await render(ProfileEditPage)
    expect(w.get('[data-testid=profile-back]').attributes('href')).toBe('/profile')
    expect(w.get('[data-testid=profile-save]').text()).toBe('Simpan Profil')
  })
})

describe('S8 late refresh does not undo edits', () => {
  const FRESH: UserMe = { ...USER, grade: 3, school: null, schoolId: null, name: 'Dari Server' }

  it('keeps a cleared school when GET /api/me resolves afterwards', async () => {
    let resolve!: (me: UserMe) => void
    const w = await render(ProfileEditPage, USER, new Promise<UserMe | null>((r) => (resolve = r)))
    await w.get('[data-testid=school-clear]').trigger('click')
    resolve({ ...FRESH, school: SCHOOL, schoolId: SCHOOL.id })
    await flushPromises()
    expect(w.find('[data-testid=school-chip]').exists()).toBe(false)
    expect((w.get('[data-testid=profile-name-input]').element as HTMLInputElement).value).toBe(
      'Pelajar Demo',
    )
  })

  it('keeps a clicked grade when GET /api/me resolves afterwards', async () => {
    let resolve!: (me: UserMe) => void
    const w = await render(ProfileEditPage, USER, new Promise<UserMe | null>((r) => (resolve = r)))
    groupOf(w).vm.$emit('update:modelValue', 9)
    await flushPromises()
    resolve(FRESH)
    await flushPromises()
    expect(checkedGrade(w)[0]?.attributes('value')).toBe('9')
    expect((w.get('[data-testid=profile-name-input]').element as HTMLInputElement).value).toBe(
      'Pelajar Demo',
    )
  })

  it('re-seeds from the server when nothing was edited', async () => {
    const w = await render(ProfileEditPage, USER, Promise.resolve(FRESH))
    expect((w.get('[data-testid=profile-name-input]').element as HTMLInputElement).value).toBe(
      'Dari Server',
    )
    expect(w.find('[data-testid=school-chip]').exists()).toBe(false)
  })
})

describe('S8 school picker (FR-M01-42, 43)', () => {
  it('shows the chip with type, state and district, and the clear button restores the search', async () => {
    const w = await render(ProfileEditPage)
    expect(w.get('[data-testid=school-chip-name]').text()).toBe('SMK DEMO')
    expect(w.get('[data-testid=school-chip-detail]').text()).toBe(
      'SMK · Selangor · PPD PETALING UTAMA',
    )
    await w.get('[data-testid=school-clear]').trigger('click')
    expect(w.find('[data-testid=school-chip]').exists()).toBe(false)
    const items = selectOf(w).props('items') as { label: string }[]
    expect(items).toHaveLength(17)
    expect(items[0]?.label).toBe('Semua Negeri')
    expect(items[5]?.label).toBe('Labuan')
    expect(w.get('[data-testid=profile-school-search]').attributes('placeholder')).toBe(
      'Taip nama sekolah (min. 2 huruf)...',
    )
  })

  it('omits the chip parts that are missing', async () => {
    const w = await render(ProfileEditPage, {
      ...USER,
      school: { ...SCHOOL, district: null },
    })
    expect(w.get('[data-testid=school-chip-detail]').text()).toBe('SMK · Selangor')
  })

  it('searches after 300 ms from 2 characters with limit 20 and picks a row', async () => {
    vi.useFakeTimers()
    searchSchools.mockResolvedValue([SCHOOL])
    const w = await render(ProfileEditPage, { ...USER, school: null, schoolId: null })
    const input = w.get('[data-testid=profile-school-search]')
    await input.trigger('focus')
    await input.setValue('d')
    await vi.advanceTimersByTimeAsync(400)
    expect(searchSchools).not.toHaveBeenCalled()
    await input.setValue('de')
    await vi.advanceTimersByTimeAsync(299)
    expect(searchSchools).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(searchSchools).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'de', limit: 20, state: null }),
    )
    const rows = w.findAll('[data-testid=school-option]')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.text()).toContain('SMK · Selangor · PPD PETALING UTAMA')
    await rows[0]?.trigger('click')
    expect(w.get('[data-testid=school-chip-name]').text()).toBe('SMK DEMO')
  })

  it('loads a state with an empty query and shows the two-line empty state', async () => {
    vi.useFakeTimers()
    searchSchools.mockResolvedValue([])
    const w = await render(ProfileEditPage, { ...USER, school: null, schoolId: null })
    selectOf(w).vm.$emit('update:modelValue', 'Perlis')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(searchSchools).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'Perlis', limit: 20 }),
    )
    const input = w.get('[data-testid=profile-school-search]')
    await input.trigger('focus')
    await input.setValue('zzz')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    const empty = w.get('[data-testid=school-empty]')
    expect(empty.text()).toContain('Tiada sekolah dijumpai')
    expect(empty.text()).toContain('Cuba tukar negeri atau kata kunci lain')
  })

  it('shows nothing when the search fails', async () => {
    vi.useFakeTimers()
    searchSchools.mockRejectedValue(new Error('boom'))
    const w = await render(ProfileEditPage, { ...USER, school: null, schoolId: null })
    const input = w.get('[data-testid=profile-school-search]')
    await input.trigger('focus')
    await input.setValue('de')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(w.find('[data-testid=school-option]').exists()).toBe(false)
    expect(w.find('[data-testid=school-empty]').exists()).toBe(false)
  })
})

describe('S8 picture card (FR-M01-41)', () => {
  const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' })

  async function choose(w: VueWrapper, file: File): Promise<void> {
    w.findComponent({ name: 'FileUpload' }).vm.$emit('update:modelValue', file)
    await vi.waitFor(() =>
      expect(w.get('[data-testid=picture-preview]').attributes('src')).toContain('data:image/png'),
    )
  }

  it('offers the hint and accept list, and hides "Simpan" until a file is chosen', async () => {
    const w = await render(ProfileEditPage)
    expect(w.text()).toContain('JPG, PNG atau WEBP. Maks 2MB.')
    expect(w.findComponent({ name: 'FileUpload' }).props('accept')).toBe(
      'image/jpeg,image/png,image/webp',
    )
    expect(w.find('[data-testid=picture-save]').exists()).toBe(false)
  })

  it('only previews on choose, and posts the file on "Simpan"', async () => {
    apiMocks.uploadPicture.mockResolvedValue({
      data: { avatarUrl: 'data:image/png;base64,AAAA' },
      status: 'Gambar profil berjaya dikemaskini.',
    })
    const w = await render(ProfileEditPage)
    const file = png()
    await choose(w, file)
    expect(apiMocks.uploadPicture).not.toHaveBeenCalled()
    expect(w.find('[data-testid=picture-save]').exists()).toBe(true)
    await w.get('[data-testid=picture-form]').trigger('submit')
    await flushPromises()
    expect(apiMocks.uploadPicture).toHaveBeenCalledWith(file)
    // The preview stays until the saved avatarUrl arrives (no flicker to the old image).
    expect(w.get('[data-testid=picture-preview]').attributes('src')).toContain('data:image/png')
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Gambar profil berjaya dikemaskini.',
    })
  })

  it('shows the server error in the red flash', async () => {
    apiMocks.uploadPicture.mockRejectedValue(
      apiError({
        profilePicture: 'The profile picture field must be a file of type: jpeg, png, webp.',
      }),
    )
    const w = await render(ProfileEditPage)
    await choose(w, png())
    await w.get('[data-testid=picture-form]').trigger('submit')
    await flushPromises()
    expect(useFlashStore().current?.type).toBe('error')
  })
})

describe('S8 password card (FR-M01-45)', () => {
  it('has three fields, no required attributes, no toggles and the 6-character hint', async () => {
    const w = await render(ProfileEditPage)
    const form = w.get('[data-testid=password-form]')
    expect(form.text()).toContain('Kata Laluan Semasa')
    expect(form.text()).toContain('Kata Laluan Baharu')
    expect(form.text()).toContain('Sahkan Kata Laluan Baharu')
    expect(form.text()).toContain('Sekurang-kurangnya 6 aksara')
    for (const input of form.findAll('input')) {
      expect(input.attributes('required')).toBeUndefined()
      expect(input.attributes('type')).toBe('password')
    }
    expect(form.findAll('button')).toHaveLength(1)
    expect(w.get('[data-testid=password-current]').attributes('autocomplete')).toBe(
      'current-password',
    )
    expect(w.get('[data-testid=password-new]').attributes('autocomplete')).toBe('new-password')
    expect(w.get('[data-testid=password-confirm]').attributes('autocomplete')).toBe('new-password')
  })

  it('clears the fields and shows the success flash', async () => {
    apiMocks.changePassword.mockResolvedValue('Kata laluan berjaya dikemaskini.')
    const w = await render(ProfileEditPage)
    await w.get('[data-testid=password-current]').setValue('Demo1234')
    await w.get('[data-testid=password-new]').setValue('Baru1234')
    await w.get('[data-testid=password-confirm]').setValue('Baru1234')
    await w.get('[data-testid=password-form]').trigger('submit')
    await flushPromises()
    expect(apiMocks.changePassword).toHaveBeenCalledWith({
      currentPassword: 'Demo1234',
      password: 'Baru1234',
      passwordConfirmation: 'Baru1234',
    })
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Kata laluan berjaya dikemaskini.',
    })
    expect((w.get('[data-testid=password-current]').element as HTMLInputElement).value).toBe('')
    expect((w.get('[data-testid=password-new]').element as HTMLInputElement).value).toBe('')
  })

  it('re-reads the session after the change: the API rotated it, so the CSRF token is new (DV-27)', async () => {
    apiMocks.changePassword.mockResolvedValue('Kata laluan berjaya dikemaskini.')
    const fresh = {
      token: 'csrf-new',
      csrf: 'csrf-new',
      remember: false,
      expiresAt: '2099-01-01T00:00:00+08:00',
      user: USER,
    }
    apiMocks.getSession.mockResolvedValue(fresh)
    const w = await render(ProfileEditPage)
    await w.get('[data-testid=password-current]').setValue('Demo1234')
    await w.get('[data-testid=password-new]').setValue('Baru1234')
    await w.get('[data-testid=password-confirm]').setValue('Baru1234')
    await w.get('[data-testid=password-form]').trigger('submit')
    await flushPromises()
    expect(apiMocks.getSession).toHaveBeenCalledWith(false)
    expect(useSessionStore().auth?.csrf).toBe('csrf-new')
    expect(useFlashStore().current?.type).toBe('success')
  })

  it('still shows the success flash when the session cannot be re-read (the password changed)', async () => {
    apiMocks.changePassword.mockResolvedValue('Kata laluan berjaya dikemaskini.')
    apiMocks.getSession.mockRejectedValue(new Error('offline'))
    const w = await render(ProfileEditPage)
    await w.get('[data-testid=password-form]').trigger('submit')
    await flushPromises()
    expect(useFlashStore().current?.type).toBe('success')
  })

  it('shows the server error and keeps the typed values', async () => {
    apiMocks.changePassword.mockRejectedValue(
      apiError({ currentPassword: 'The password is incorrect.' }),
    )
    const w = await render(ProfileEditPage)
    await w.get('[data-testid=password-current]').setValue('salah')
    await w.get('[data-testid=password-form]').trigger('submit')
    await flushPromises()
    expect(useFlashStore().current).toEqual({
      type: 'error',
      message: ['The password is incorrect.'],
    })
    expect((w.get('[data-testid=password-current]').element as HTMLInputElement).value).toBe(
      'salah',
    )
  })
})
