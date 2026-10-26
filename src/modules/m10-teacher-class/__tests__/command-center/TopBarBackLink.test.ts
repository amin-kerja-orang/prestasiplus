// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useSessionStore } from '@/stores/session'

import TopBar from '../../components/command-center/TopBar.vue'

/**
 * DV-M10-37: `/guru` is teacher-only in http mode, so the "Dashboard" back link of S2 sends the admin to the
 * admin home there; in mock mode `/guru` admits the admin and stays the target.
 */
function backHref(role: 'teacher' | 'admin', mode: 'http' | 'mock'): string | undefined {
  vi.stubEnv('VITE_API_MODE', mode)
  setActivePinia(createPinia())
  useSessionStore().setSession({
    token: 't',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: { id: 2, role, landingPath: '/guru' } as never,
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  const w = mount(TopBar, {
    props: { paused: false, fullscreen: false },
    global: { plugins: [router] },
  })
  const href = w.find('[data-testid="cc-back"]').attributes('href')
  w.unmount()
  return href
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('S2 back link', () => {
  it('http mode: the teacher goes to /guru and the admin to the admin home', () => {
    expect(backHref('teacher', 'http')).toBe('/guru')
    expect(backHref('admin', 'http')).toBe('/admin/command-center')
  })

  it('mock mode: /guru for both roles', () => {
    expect(backHref('teacher', 'mock')).toBe('/guru')
    expect(backHref('admin', 'mock')).toBe('/guru')
  })
})
