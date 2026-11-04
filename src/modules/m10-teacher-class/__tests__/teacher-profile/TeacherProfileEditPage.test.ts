// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { api, ApiError } from '@/api'
import type { UserMe } from '@/modules/m01-authentication'
import { useFlashStore } from '@/stores/flash'
import { useSessionStore } from '@/stores/session'

import TeacherProfileEditPage from '../../pages/TeacherProfileEditPage.vue'

/** S5-T05 part C: `/guru/profil/edit` "Edit Profil Guru" (R1-GUR-A1, API-GUR-22). */
const PROFILE = {
  name: 'Guru Demo',
  bio: 'Pendidik Sains.',
  icMasked: 'xxxxxx-xx-xx32',
  subject: 'Matematik',
  qualification: 'Ijazah Sarjana Pendidikan',
  experienceYears: 7,
  school: { name: 'SMK DEMO' },
}

const USER = {
  id: 42,
  name: 'Guru Demo',
  email: 'guru@demo.test',
  phone: '0123456789',
  role: 'teacher',
  grade: null,
  schoolId: 8101,
  bio: null,
  avatarUrl: null,
  createdAt: '2026-02-06T09:00:00+08:00',
  updatedAt: '2026-02-06T09:00:00+08:00',
  lastLoginAt: null,
  school: null,
  landingPath: '/guru',
} as unknown as UserMe

let wrapper: VueWrapper | null = null
let router: Router
let getSpy: MockInstance<typeof api.get>

async function render(profile: object | Error = PROFILE): Promise<VueWrapper> {
  const session = useSessionStore()
  session.setSession({ token: 't', remember: false, expiresAt: '2099-01-01T00:00:00+08:00', user: USER })
  vi.spyOn(session, 'refreshUser').mockResolvedValue(null)
  getSpy = vi.spyOn(api, 'get')
  if (profile instanceof Error) getSpy.mockRejectedValue(profile)
  else getSpy.mockResolvedValue(profile)
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }] })
  await router.push('/guru/profil/edit')
  wrapper = mount(TeacherProfileEditPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const input = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const value = (w: VueWrapper, id: string) => (input(w, id).element as HTMLInputElement).value
const submit = async (w: VueWrapper) => {
  await w.get('[data-testid="teacher-profile-form"]').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  window.scrollTo = vi.fn()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('TeacherProfileEditPage', () => {
  it('has the cards in order with the PRD labels, placeholders and help texts', async () => {
    const w = await render()
    const headings = w.findAll('h2').map((h) => h.text())
    expect(headings).toEqual(['Maklumat Peribadi', 'Sekolah', 'Maklumat Profesional', 'Profil Awam Anda'])
    const text = w.text()
    for (const label of ['Nama Penuh *', 'E-mel', 'Bio', 'No Kad Pengenalan', 'Subjek Utama', 'Kelayakan', 'Pengalaman (tahun)']) expect(text).toContain(label)
    expect(text).toContain('E-mel log masuk tidak boleh ditukar di sini.')
    expect(text).toContain('Digunakan untuk reset kata laluan secara layan diri. Tanpa tanda sempang (-).')
    expect(input(w, 'teacher-bio-input').attributes('placeholder')).toBe('Ceritakan tentang diri anda sebagai pendidik...')
    expect(input(w, 'teacher-ic-input').attributes('placeholder')).toBe('cth: 860101015432')
    expect(input(w, 'teacher-subject-input').attributes('placeholder')).toBe('cth: Matematik, Sains')
    expect(input(w, 'teacher-qualification-input').attributes('placeholder')).toBe('cth: Ijazah Sarjana Pendidikan')
    expect(w.text()).toContain('Batal')
    expect(w.text()).toContain('Simpan Profil')
  })

  it('loads the own profile: values, read-only e-mel, the school name read-only and the masked IC', async () => {
    const w = await render()
    expect(getSpy).toHaveBeenCalledWith('/api/account/teacher-profile')
    expect(value(w, 'teacher-name-input')).toBe('Guru Demo')
    expect(value(w, 'teacher-bio-input')).toBe('Pendidik Sains.')
    expect(value(w, 'teacher-subject-input')).toBe('Matematik')
    expect(value(w, 'teacher-qualification-input')).toBe('Ijazah Sarjana Pendidikan')
    expect(value(w, 'teacher-experience-input')).toBe('7')
    expect(value(w, 'teacher-ic-input')).toBe('xxxxxx-xx-xx32')
    const email = input(w, 'teacher-email-input')
    expect(value(w, 'teacher-email-input')).toBe('guru@demo.test')
    expect(email.attributes('readonly')).toBeDefined()
    expect(email.attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="teacher-school-name"]').text()).toBe('SMK DEMO')
    // The school is a name only: no picker, no search field.
    expect(w.find('[data-testid="teacher-card-school"] input').exists()).toBe(false)
  })

  it('saves name, bio, subject, qualification and experience; no school, phone or e-mail; the masked IC is not re-sent', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { ...PROFILE, subject: 'Sains' }, status: 'Profil dikemaskini.' })
    const w = await render()
    await input(w, 'teacher-subject-input').setValue('Sains')
    await submit(w)
    expect(put).toHaveBeenCalledTimes(1)
    const [path, options] = put.mock.calls[0] as [string, { body: Record<string, unknown>; raw: boolean }]
    expect(path).toBe('/api/account/teacher-profile')
    expect(options.body).toEqual({ name: 'Guru Demo', bio: 'Pendidik Sains.', subject: 'Sains', qualification: 'Ijazah Sarjana Pendidikan', experienceYears: 7 })
    for (const key of ['schoolId', 'phone', 'email', 'ic']) expect(options.body).not.toHaveProperty(key)
    expect(useFlashStore().current).toEqual({ type: 'success', message: 'Profil dikemaskini.' })
    expect(value(w, 'teacher-subject-input')).toBe('Sains')
  })

  it('sends a newly typed IC (12 digits) and shows the masked value the server returns', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { ...PROFILE, icMasked: 'xxxxxx-xx-xx78' }, status: 'Profil dikemaskini.' })
    const w = await render()
    await input(w, 'teacher-ic-input').setValue('900202025678')
    await submit(w)
    const options = put.mock.calls[0]?.[1] as { body: Record<string, unknown> }
    expect(options.body.ic).toBe('900202025678')
    expect(value(w, 'teacher-ic-input')).toBe('xxxxxx-xx-xx78')
  })

  it('refuses an 11-digit IC with the PRD text and saves nothing (AC-GUR-A1-6)', async () => {
    const put = vi.spyOn(api, 'put')
    const w = await render()
    await input(w, 'teacher-ic-input').setValue('86010101543')
    await submit(w)
    expect(w.text()).toContain('No. IC mesti 12 digit tanpa sempang.')
    expect(put).not.toHaveBeenCalled()
  })

  it('refuses a hyphenated IC', async () => {
    const w = await render()
    await input(w, 'teacher-ic-input').setValue('860101-01-5432')
    await submit(w)
    expect(w.text()).toContain('No. IC mesti 12 digit tanpa sempang.')
  })

  it('validates every field with the exact BM text', async () => {
    const put = vi.spyOn(api, 'put')
    const w = await render()
    await input(w, 'teacher-name-input').setValue('  ')
    await input(w, 'teacher-bio-input').setValue('b'.repeat(1001))
    await input(w, 'teacher-subject-input').setValue('s'.repeat(101))
    await input(w, 'teacher-qualification-input').setValue('q'.repeat(151))
    await input(w, 'teacher-experience-input').setValue('61')
    await submit(w)
    const text = w.text()
    for (const line of [
      'Sila isi nama penuh.',
      'Bio tidak boleh melebihi 1000 aksara.',
      'Subjek utama tidak boleh melebihi 100 aksara.',
      'Kelayakan tidak boleh melebihi 150 aksara.',
      'Pengalaman mesti antara 0 dan 60 tahun.',
    ]) expect(text).toContain(line)
    expect(put).not.toHaveBeenCalled()
    await input(w, 'teacher-name-input').setValue('n'.repeat(256))
    await submit(w)
    expect(w.text()).toContain('Nama penuh tidak boleh melebihi 255 aksara.')
  })

  it('accepts 60 years (AC-GUR-A1-7) and 0', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({ data: { ...PROFILE, experienceYears: 60 }, status: 'Profil dikemaskini.' })
    const w = await render()
    await input(w, 'teacher-experience-input').setValue('60')
    await submit(w)
    expect((put.mock.calls[0]?.[1] as { body: { experienceYears: number } } | undefined)?.body.experienceYears).toBe(60)
    expect(useFlashStore().current?.message).toBe('Profil dikemaskini.')
  })

  it('keeps the typed values and shows the server field text on a duplicate IC', async () => {
    vi.spyOn(api, 'put').mockRejectedValue(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'No. IC sudah didaftarkan.', fields: { ic: 'No. IC sudah didaftarkan.' } }))
    const w = await render()
    await input(w, 'teacher-ic-input').setValue('900202025678')
    await input(w, 'teacher-subject-input').setValue('Sejarah')
    await submit(w)
    expect(w.text()).toContain('No. IC sudah didaftarkan.')
    expect(value(w, 'teacher-subject-input')).toBe('Sejarah')
    expect(value(w, 'teacher-ic-input')).toBe('900202025678')
    expect(useFlashStore().current).toBeNull()
  })

  it('shows the BM generic line for a failure without a field (network)', async () => {
    vi.spyOn(api, 'put').mockRejectedValue(new Error('Failed to fetch'))
    const w = await render()
    await submit(w)
    expect(useFlashStore().current).toEqual({ type: 'error', message: 'Ralat berlaku. Sila cuba lagi.' })
  })

  it('"Simpan Profil" turns to "Menyimpan..." while saving', async () => {
    let finish: (v: unknown) => void = () => undefined
    vi.spyOn(api, 'put').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const w = await render()
    await w.get('[data-testid="teacher-profile-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="teacher-save"]').text()).toBe('Menyimpan...')
    finish({ data: PROFILE, status: 'Profil dikemaskini.' })
    await flushPromises()
    expect(w.get('[data-testid="teacher-save"]').text()).toBe('Simpan Profil')
  })

  it('"Batal" leaves without saving and without a dialog', async () => {
    const put = vi.spyOn(api, 'put')
    const w = await render()
    await w.get('[data-testid="teacher-cancel"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/profile')
    expect(put).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('"Profil Awam Anda": the link of this teacher, "Salin Link" -> "Disalin!" for 2 s, and "Lihat"', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = await render()
    expect(w.text()).toContain('Kongsi profil anda dengan guru-guru lain di platform.')
    const url = `${window.location.origin}/guru/profil/42`
    expect(value(w, 'teacher-public-url')).toBe(url)
    expect(w.get('[data-testid="teacher-view"]').attributes('href')).toBe('/guru/profil/42')
    expect(w.get('[data-testid="teacher-copy"]').text()).toBe('Salin Link')
    await w.get('[data-testid="teacher-copy"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(url)
    expect(w.get('[data-testid="teacher-copy"]').text()).toBe('Disalin!')
    vi.advanceTimersByTime(2000)
    await flushPromises()
    expect(w.get('[data-testid="teacher-copy"]').text()).toBe('Salin Link')
    vi.useRealTimers()
  })

  it('shows a load error with a retry when the profile cannot be read', async () => {
    const w = await render(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }))
    expect(w.find('[data-testid="teacher-profile-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="teacher-profile-form"]').exists()).toBe(false)
  })
})
