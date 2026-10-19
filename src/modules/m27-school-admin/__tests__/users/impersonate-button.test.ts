// @vitest-environment jsdom
/**
 * M27-T6 "Menyamar" button (FR-M27-121 to 124; AC 36.1 to 36.3): enabled/disabled states and titles, the native
 * confirm, the session switch with the parked impersonator, the flash, the landing path, and the refusals.
 */
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'
import { useSessionStore } from '@/stores/session'

import ImpersonateButton from '../../components/users/ImpersonateButton.vue'
import { mountAt } from './helpers'

const api = vi.hoisted(() => ({ impersonateSchoolUser: vi.fn() }))
vi.mock('../../api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('../../api/school-admin')>()),
  ...api,
}))

const confirmSpy = vi.spyOn(window, 'confirm')
const BTN = '[data-testid="user-impersonate"]'

const started = (landingPath: string, role: 'student' | 'teacher', name: string) => ({
  data: {
    token: 'target-token',
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: {
      id: 3001,
      name,
      email: 'x@demo.test',
      phone: null,
      role,
      grade: null,
      schoolId: 900001,
      bio: null,
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00+08:00',
      updatedAt: '2026-01-01T00:00:00+08:00',
      lastLoginAt: null,
      school: null,
      landingPath,
    },
    impersonator: { id: 8, name: 'Admin Contoh' },
  },
  status: `Anda kini menyamar sebagai ${name}.`,
})

beforeEach(() => {
  api.impersonateSchoolUser.mockReset()
  confirmSpy.mockReset()
})
afterEach(() => confirmSpy.mockReset())

const props = { userId: 3001, name: 'Murid Contoh Satu', isActive: true, role: 'student' }

describe('"Menyamar" states', () => {
  it('is enabled with its title for an active account', async () => {
    const { wrapper } = await mountAt(ImpersonateButton, '/admin-sekolah/pelajar', props)
    const btn = wrapper.get(BTN)
    expect(btn.text()).toBe('Menyamar')
    expect(btn.attributes('title')).toBe('Log masuk sebagai pengguna ini')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('is present but disabled with the inactive title for an inactive account', async () => {
    const { wrapper } = await mountAt(ImpersonateButton, '/admin-sekolah/pelajar', {
      ...props,
      isActive: false,
    })
    const btn = wrapper.get(BTN)
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.attributes('title')).toBe('Akaun ini tidak aktif')
    await btn.trigger('click')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(api.impersonateSchoolUser).not.toHaveBeenCalled()
  })

})

describe('"Menyamar" start', () => {
  it('cancelling the confirm does nothing', async () => {
    confirmSpy.mockReturnValue(false)
    const { wrapper } = await mountAt(ImpersonateButton, '/admin-sekolah/pelajar', props)
    await wrapper.get(BTN).trigger('click')
    expect(confirmSpy).toHaveBeenCalledWith(
      'Log masuk sebagai Murid Contoh Satu? Anda boleh kembali bila-bila masa.',
    )
    expect(api.impersonateSchoolUser).not.toHaveBeenCalled()
    expect(useSessionStore().role).toBe('school_admin')
  })

  it('accepting stores the target session with the actor parked, flashes and opens the landing path', async () => {
    confirmSpy.mockReturnValue(true)
    api.impersonateSchoolUser.mockResolvedValue(
      started('/dashboard', 'student', 'Murid Contoh Satu'),
    )
    const { wrapper, router } = await mountAt(ImpersonateButton, '/admin-sekolah/pelajar', props)
    await wrapper.get(BTN).trigger('click')
    await flushPromises()
    expect(api.impersonateSchoolUser).toHaveBeenCalledWith(3001)
    const session = useSessionStore()
    expect(session.token).toBe('target-token')
    expect(session.role).toBe('student')
    expect(session.impersonator).toEqual({
      id: 8,
      name: 'Admin Contoh',
      returnTo: '/admin-sekolah/pelajar',
    })
    expect(useFlashStore().pending).toEqual({
      type: 'success',
      message: 'Anda kini menyamar sebagai Murid Contoh Satu.',
    })
    expect(router.currentRoute.value.path).toBe('/dashboard')
  })

  it('a teacher target returns to S7 and lands on /guru', async () => {
    confirmSpy.mockReturnValue(true)
    api.impersonateSchoolUser.mockResolvedValue(started('/guru', 'teacher', 'Guru Contoh Satu'))
    const { wrapper, router } = await mountAt(ImpersonateButton, '/admin-sekolah/guru', {
      userId: 5,
      name: 'Guru Contoh Satu',
      isActive: true,
      role: 'teacher',
    })
    await wrapper.get(BTN).trigger('click')
    await flushPromises()
    expect(useSessionStore().impersonator?.returnTo).toBe('/admin-sekolah/guru')
    expect(router.currentRoute.value.path).toBe('/guru')
  })

  it('a refusal shows the server message and keeps the admin session', async () => {
    confirmSpy.mockReturnValue(true)
    api.impersonateSchoolUser.mockRejectedValue(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Anda sedang menyamar.' }),
    )
    const { wrapper, router } = await mountAt(ImpersonateButton, '/admin-sekolah/pelajar', props)
    await wrapper.get(BTN).trigger('click')
    await flushPromises()
    expect(useFlashStore().current).toEqual({ type: 'error', message: ['Anda sedang menyamar.'] })
    expect(useSessionStore().role).toBe('school_admin')
    expect(useSessionStore().impersonator).toBeNull()
    expect(router.currentRoute.value.path).toBe('/admin-sekolah/pelajar')
  })
})
