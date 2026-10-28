// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { logIn, NOW, STUDENT } from '@/app/__tests__/router-fixtures'
import { clock } from '@/lib/time'
import { useSessionStore } from '@/stores/session'

import { usePrototypeScope } from '../usePrototypeScope'

/** A fresh Pinia with the stored session loaded (as the router guard does). */
function restore(): void {
  setActivePinia(createPinia())
  expect(useSessionStore().check()).toBe(true)
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
  clock.reset()
})

afterEach(() => {
  clock.reset()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('usePrototypeScope: home', () => {
  it.each(['off', 'on'])('scope %s: the role home, read from the session', (scope) => {
    vi.stubEnv('VITE_PROTOTYPE_SCOPE', scope)
    logIn({ ...STUDENT, id: 5, role: 'teacher', grade: null })
    restore()
    expect(usePrototypeScope().home.value).toBe('/guru')
  })

  it('scope off, school admin: /admin-sekolah', () => {
    logIn({ ...STUDENT, id: 6, role: 'school_admin', grade: null })
    restore()
    expect(usePrototypeScope().home.value).toBe('/admin-sekolah')
  })

  it('scope off, student: /dashboard, and every path allowed', () => {
    logIn(STUDENT)
    restore()
    const scope = usePrototypeScope()
    expect(scope.home.value).toBe('/dashboard')
    expect(scope.allows('/admin/users')).toBe(true)
  })
})
