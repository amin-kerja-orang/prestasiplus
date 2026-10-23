// @vitest-environment jsdom
/**
 * S8 `/profile/edit` "Maklumat Sekolah" (DV-28, AM2-SW2-11): in http mode only a student or a parent can set a
 * school (the API ignores `schoolId` for every other role), so the card is shown only for them. Mock mode (live)
 * shows it for every role.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import type { Role, SchoolSummary, UserMe } from '../../api'
import ProfileEditPage from '../../pages/ProfileEditPage.vue'

const mode = vi.hoisted(() => ({ http: true }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => mode.http }))

const apiMocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  uploadPicture: vi.fn(),
  changePassword: vi.fn(),
}))
vi.mock('../../api', () => apiMocks)

const searchSchools = vi.hoisted(() => vi.fn())
vi.mock('@/modules/m02-users-schools', () => ({ searchSchools }))

const SCHOOL: SchoolSummary = {
  id: 8101,
  name: 'SMK CONTOH',
  code: 'ABA0001',
  type: 'SMK',
  state: 'Selangor',
  district: 'PPD CONTOH',
  city: 'Petaling Jaya',
}

function userOf(role: Role): UserMe {
  return {
    id: 2,
    name: 'Pengguna Contoh',
    email: 'pengguna@contoh.test',
    phone: '0123456789',
    role,
    grade: 10,
    schoolId: SCHOOL.id,
    bio: null,
    avatarUrl: null,
    createdAt: '2026-02-06T09:00:00+08:00',
    updatedAt: '2026-02-06T09:00:00+08:00',
    lastLoginAt: null,
    school: SCHOOL,
    landingPath: '/dashboard',
  }
}

let wrapper: VueWrapper | null = null

async function render(role: Role): Promise<VueWrapper> {
  const session = useSessionStore()
  session.setSession({
    token: 't',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: userOf(role),
  })
  vi.spyOn(session, 'refreshUser').mockResolvedValue(null)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/profile/edit', component: ProfileEditPage },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/profile/edit')
  wrapper = mount(ProfileEditPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mode.http = true
  localStorage.clear()
  setActivePinia(createPinia())
  for (const fn of Object.values(apiMocks)) fn.mockReset()
  searchSchools.mockReset()
  window.scrollTo = vi.fn()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('S8 Maklumat Sekolah, http mode', () => {
  it.each(['student', 'parent'] as const)('shows the school card for a %s', async (role) => {
    const w = await render(role)
    expect(w.find('[data-testid=profile-school-card]').exists()).toBe(true)
    expect(w.text()).toContain('Maklumat Sekolah')
    expect(w.find('[data-testid=profile-school]').exists()).toBe(true)
  })

  it.each(['teacher', 'school_admin', 'ppd_officer', 'sponsor', 'admin'] as const)(
    'hides the school card for a %s, keeps Tahap, and does not send schoolId',
    async (role) => {
      apiMocks.updateProfile.mockResolvedValue({
        data: userOf(role),
        status: 'Profil berjaya dikemaskini.',
      })
      const w = await render(role)
      expect(w.find('[data-testid=profile-school-card]').exists()).toBe(false)
      expect(w.text()).not.toContain('Maklumat Sekolah')
      expect(w.find('[data-testid=grade-picker]').exists()).toBe(true)
      await w.get('[data-testid=profile-form]').trigger('submit')
      await flushPromises()
      const sent = apiMocks.updateProfile.mock.calls[0]?.[0] as Record<string, unknown>
      expect(sent).toMatchObject({ name: 'Pengguna Contoh', grade: 10 })
      expect(sent).not.toHaveProperty('schoolId')
    },
  )
})

describe('S8 Maklumat Sekolah, mock mode (live)', () => {
  it('shows the card for every role and sends schoolId', async () => {
    mode.http = false
    apiMocks.updateProfile.mockResolvedValue({
      data: userOf('teacher'),
      status: 'Profil berjaya dikemaskini.',
    })
    const w = await render('teacher')
    expect(w.find('[data-testid=profile-school-card]').exists()).toBe(true)
    await w.get('[data-testid=profile-form]').trigger('submit')
    await flushPromises()
    expect(apiMocks.updateProfile.mock.calls[0]?.[0]).toMatchObject({ schoolId: SCHOOL.id })
  })
})
