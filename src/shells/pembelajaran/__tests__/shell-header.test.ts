// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory } from 'vue-router'

import { api, installTransport } from '@/api'
import type { ModuleManifest } from '@/app/modules'
import LayoutHost from '@/app/LayoutHost.vue'
import { createAppRouter, setRouteOutcome } from '@/app/router'
import { fakeTransport, logIn, NOW, STUDENT } from '@/app/__tests__/router-fixtures'
import { usePageMeta } from '@/composables/usePageMeta'
import { clock } from '@/lib/time'
import { NOTIFICATION_PUSH_EVENT } from '@/shells/user/constants'
import { setUnauthorizedRedirect } from '@/stores'
import { useNotificationBadgeStore } from '@/stores/notification-badge'

const leave = vi.hoisted(() => vi.fn())
vi.mock('@/modules/m27-school-admin', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  leaveImpersonation: leave,
}))

const Page = defineComponent({ name: 'HeaderPage', setup: () => () => h('p', 'page') })

const REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-header',
    routes: [
      ...['/dashboard', '/guru', '/admin-sekolah'].map((path) => ({
        path,
        component: Page,
        meta: { layout: 'user' as const, v2: true, header: { title: 'Tanpa Sub' } },
      })),
      {
        path: '/peta-belajar',
        component: Page,
        meta: {
          layout: 'user',
          v2: true,
          header: { title: 'Tajuk Laluan', subtitle: 'Sub Laluan' },
        },
      },
    ],
  },
]

// The router loads the Pembelajaran layout lazily; preload it so mounting resolves at once.
beforeAll(async () => {
  await import('../PembelajaranLayout.vue')
})

let pinia: Pinia
let wrapper: VueWrapper | null = null

async function open(
  path: string,
  session: Parameters<typeof logIn>[1] = {},
  who: typeof STUDENT = STUDENT,
): Promise<VueWrapper> {
  logIn(who, session)
  const router = createAppRouter({ history: createMemoryHistory(), registry: REGISTRY })
  await router.push(path)
  wrapper = mount(LayoutHost, { global: { plugins: [pinia, router] }, attachTo: document.body })
  await vi.waitFor(() =>
    expect(wrapper?.find('[data-testid="pembelajaran-bottom-nav"]').exists()).toBe(true),
  )
  return wrapper
}

beforeEach(() => {
  // vitest.config.ts turns the prototype scope off; the Pembelajaran shell is only used with it on.
  vi.stubEnv('VITE_PROTOTYPE_SCOPE', 'on')
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date', 'setInterval', 'clearInterval'] })
  clock.reset()
  pinia = createPinia()
  setActivePinia(pinia)
  setRouteOutcome(null)
  installTransport(fakeTransport(() => ({})))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  leave.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  clock.reset()
  vi.useRealTimers()
  setUnauthorizedRedirect(null)
  api.configure({ transport: null })
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('PembelajaranLayout bell (C-6, FR-M01-53)', () => {
  it('refreshes the bell when a foreground notification push arrives', async () => {
    await open('/peta-belajar')
    const refresh = vi.spyOn(useNotificationBadgeStore(pinia), 'refresh').mockResolvedValue(0)
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PUSH_EVENT))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('stops listening once the layout is unmounted', async () => {
    await open('/peta-belajar')
    const refresh = vi.spyOn(useNotificationBadgeStore(pinia), 'refresh').mockResolvedValue(0)
    wrapper?.unmount()
    wrapper = null
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PUSH_EVENT))
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('PembelajaranLayout title and subtitle (C-7)', () => {
  it('prints the route header title and subtitle', async () => {
    const w = await open('/peta-belajar')
    expect(w.get('[data-testid="pembelajaran-header"] h1').text()).toBe('Tajuk Laluan')
    expect(w.get('[data-testid="pembelajaran-subtitle"]').text()).toBe('Sub Laluan')
  })

  it('a data-driven header (usePageMeta.setHeader) wins over the route header', async () => {
    const w = await open('/peta-belajar')
    usePageMeta().setHeader({ title: '5 MARIKH - Kimia', subtitle: 'SK Demo — Tingkatan 5' })
    await nextTick()
    expect(w.get('[data-testid="pembelajaran-header"] h1').text()).toBe('5 MARIKH - Kimia')
    expect(w.get('[data-testid="pembelajaran-subtitle"]').text()).toBe('SK Demo — Tingkatan 5')
  })

  it('shows the subtitle below md too, at 10px below sm', async () => {
    const w = await open('/peta-belajar')
    const classes = w.get('[data-testid="pembelajaran-subtitle"]').classes()
    expect(classes).not.toContain('hidden')
    expect(classes).toContain('text-[10px]')
    expect(classes).toContain('sm:text-caption')
  })
})

describe('PembelajaranLayout impersonation banner (C-10)', () => {
  it('shows no banner for an ordinary session', async () => {
    const w = await open('/peta-belajar')
    expect(w.find('[data-testid="impersonation-banner"]').exists()).toBe(false)
  })

  it('shows the target name while impersonating and "Kembali ke Admin" calls the leave action', async () => {
    leave.mockRejectedValue(new Error('stop here'))
    const w = await open('/peta-belajar', {
      impersonator: { id: 8, name: 'Admin Contoh', returnTo: '/admin-sekolah/pelajar' },
    })
    expect(w.get('[data-testid="impersonation-text"]').text()).toBe(
      `Mod menyamar — anda melihat sebagai ${STUDENT.name}`,
    )
    await w.get('[data-testid="impersonation-leave"]').trigger('click')
    expect(leave).toHaveBeenCalledTimes(1)
  })
})

describe('PembelajaranLayout role default subtitle (C-12)', () => {
  const sub = (w: VueWrapper) => w.find('[data-testid="pembelajaran-subtitle"]')

  it('a pupil page without its own subtitle shows "Selamat datang kembali"', async () => {
    const w = await open('/dashboard')
    expect(sub(w).text()).toBe('Selamat datang kembali')
  })

  it('a teacher page without its own subtitle shows the greeting with the name', async () => {
    const teacher = { ...STUDENT, id: 3, role: 'teacher' as const, grade: null, name: 'Cikgu Contoh', landingPath: '/guru' }
    const w = await open('/guru', {}, teacher)
    expect(sub(w).text()).toBe('Selamat datang, Cikgu Contoh 👩‍🏫')
  })

  it('a role without a V2 default shows no subtitle', async () => {
    const schoolAdmin = { ...STUDENT, id: 8, role: 'school_admin' as const, grade: null, landingPath: '/admin-sekolah' }
    const w = await open('/admin-sekolah', {}, schoolAdmin)
    expect(sub(w).exists()).toBe(false)
  })

  it("a page's own subtitle wins over the default", async () => {
    const w = await open('/peta-belajar')
    expect(sub(w).text()).toBe('Sub Laluan')
  })
})
